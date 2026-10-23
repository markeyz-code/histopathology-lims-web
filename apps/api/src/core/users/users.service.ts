import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import {
  isClinicalRole,
  type Paginated,
  type User as UserDto,
  type UserSummary,
} from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { buildPaginated, escapeRegex } from '../../common/utils/format';
import { hashPassword } from '../../common/utils/crypto';
import { withTransaction } from '../../common/utils/transaction';
import { toUser, toUserSummary } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { UserModelName, type UserEntity } from './user.schema';
import type { CreateUserDto, UpdateUserDto, UserListQueryDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectConnection() private readonly connection: Connection,
    private readonly audit: AuditService,
  ) {}

  async list(query: UserListQueryDto): Promise<Paginated<UserDto>> {
    const filter: Record<string, unknown> = {};
    if (query.role) filter.role = query.role;
    if (query.active !== undefined) filter.active = query.active;
    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q), 'i');
      filter.$or = [{ name: regex }, { email: regex }];
    }
    const page = query.page;
    const limit = query.limit;
    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ active: -1, name: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(
      users.map((user) => toUser(user)),
      total,
      page,
      limit,
    );
  }

  async pathologists(): Promise<UserSummary[]> {
    const users = await this.userModel
      .find({ role: 'PATHOLOGIST', active: true })
      .sort({ name: 1 })
      .exec();
    return users.map((user) => toUserSummary(user));
  }

  async findActiveById(id: string): Promise<UserEntity | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.userModel.findById(id).exec();
  }

  async assertActivePathologist(id: string): Promise<UserEntity> {
    const user = await this.findActiveById(id);
    if (!user || !user.active || user.role !== 'PATHOLOGIST') {
      throw new BadRequestException('Select an active pathologist from this laboratory.');
    }
    return user;
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser): Promise<UserDto> {
    if (dto.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only a super administrator can create another super administrator.',
      );
    }
    const email = dto.email.trim().toLowerCase();
    const existing = await this.userModel.findOne({ email }).exec();
    if (existing)
      throw new ConflictException('A user with this email already exists in the laboratory.');

    return withTransaction(this.connection, async (session) => {
      const passwordHash = await hashPassword(dto.password);
      const user = new this.userModel({
        name: dto.name.trim(),
        email,
        passwordHash,
        role: dto.role,
        phone: dto.phone?.trim() || null,
        subspecialties: dto.subspecialties ?? [],
        disciplines:
          dto.disciplines ?? (isClinicalRole(dto.role) ? (['HISTOPATHOLOGY'] as const) : []),
      });
      await user.save({ session });
      await this.audit.record(
        {
          action: 'CREATE',
          entityType: 'User',
          entityId: user._id.toString(),
          after: toUser(user),
          metadata: { role: user.role },
        },
        session,
      );
      return toUser(user);
    });
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<UserDto> {
    return withTransaction(this.connection, async (session) => {
      const user = await this.userModel.findById(id).session(session).exec();
      if (!user) throw new NotFoundException('User not found.');
      const before = toUser(user);

      if (id === actor.id && dto.role && dto.role !== user.role) {
        throw new ForbiddenException('You cannot change your own role.');
      }
      if (id === actor.id && dto.active === false) {
        throw new ForbiddenException('You cannot deactivate your own account.');
      }
      if (
        (dto.role === 'SUPER_ADMIN' || user.role === 'SUPER_ADMIN') &&
        actor.role !== 'SUPER_ADMIN'
      ) {
        throw new ForbiddenException(
          'Only a super administrator can manage super administrator roles.',
        );
      }

      if (dto.name !== undefined) user.name = dto.name.trim();
      if (dto.role !== undefined) user.role = dto.role;
      if (dto.active !== undefined) user.active = dto.active;
      if (dto.phone !== undefined) user.phone = dto.phone.trim() || null;
      if (dto.subspecialties !== undefined) user.subspecialties = dto.subspecialties;
      if (dto.disciplines !== undefined) user.disciplines = dto.disciplines;
      if (
        dto.role !== undefined &&
        isClinicalRole(dto.role) &&
        (user.disciplines ?? []).length === 0
      ) {
        user.disciplines = ['HISTOPATHOLOGY'];
      }
      if (dto.active === false) user.refreshTokenHash = null;
      await user.save({ session });

      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'User',
          entityId: user._id.toString(),
          before,
          after: toUser(user),
        },
        session,
      );
      return toUser(user);
    });
  }

  async resetPassword(
    id: string,
    password: string,
    actor: AuthenticatedUser,
  ): Promise<{ success: true }> {
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found.');
    if (user.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only a super administrator can reset this account.');
    }
    const passwordHash = await hashPassword(password);
    await withTransaction(this.connection, async (session) => {
      await this.userModel
        .updateOne(
          { _id: user._id },
          { $set: { passwordHash, refreshTokenHash: null } },
          { session },
        )
        .exec();
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'User',
          entityId: user._id.toString(),
          metadata: { passwordReset: true, targetUser: user.email },
        },
        session,
      );
    });
    return { success: true };
  }
}
