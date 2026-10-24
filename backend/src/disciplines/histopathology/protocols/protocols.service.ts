import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import { protocolContentSchema, type Protocol } from '@lims/shared';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { withTransaction } from '../../../common/utils/transaction';
import { toProtocol } from '../histopathology.serializers';
import { AuditService } from '../../../core/audit/audit.service';
import { ProtocolModelName, type ProtocolEntity } from './protocol.schema';
import type {
  CreateProtocolDto,
  ProtocolListQueryDto,
  UpdateProtocolDto,
} from './dto/protocol.dto';

@Injectable()
export class ProtocolsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ProtocolModelName) private readonly protocolModel: Model<ProtocolEntity>,
    private readonly audit: AuditService,
  ) {}

  async list(query: ProtocolListQueryDto): Promise<Protocol[]> {
    const filter: Record<string, unknown> = {};
    if (query.subspecialty) filter.subspecialty = query.subspecialty;
    if (query.active !== undefined) filter.active = query.active;
    const protocols = await this.protocolModel.find(filter).sort({ title: 1 }).exec();
    return protocols.map(toProtocol);
  }

  async get(id: string): Promise<Protocol> {
    const protocol = await this.protocolModel.findById(id).exec();
    if (!protocol) throw new NotFoundException('Protocol not found.');
    return toProtocol(protocol);
  }

  async create(dto: CreateProtocolDto, actor: AuthenticatedUser): Promise<Protocol> {
    const content = this.parseContent(dto.content);
    const key = dto.key.toLowerCase();
    return withTransaction(this.connection, async (session) => {
      const existing = await this.protocolModel.findOne({ key }).session(session).exec();
      if (existing) throw new ConflictException('A protocol with this key already exists.');
      const protocol = new this.protocolModel({
        key,
        title: dto.title.trim(),
        cancerType: dto.cancerType.trim(),
        subspecialty: dto.subspecialty.trim(),
        version: 1,
        active: true,
        content,
        createdBy: new Types.ObjectId(actor.id),
      });
      await protocol.save({ session });
      await this.audit.record(
        {
          action: 'CREATE',
          entityType: 'Protocol',
          entityId: protocol._id.toString(),
          after: toProtocol(protocol),
        },
        session,
      );
      return toProtocol(protocol);
    });
  }

  async update(id: string, dto: UpdateProtocolDto, actor: AuthenticatedUser): Promise<Protocol> {
    const content = dto.content ? this.parseContent(dto.content) : null;
    return withTransaction(this.connection, async (session) => {
      const protocol = await this.protocolModel.findById(id).session(session).exec();
      if (!protocol) throw new NotFoundException('Protocol not found.');
      const before = toProtocol(protocol);

      if (dto.title !== undefined) protocol.title = dto.title.trim();
      if (dto.cancerType !== undefined) protocol.cancerType = dto.cancerType.trim();
      if (dto.subspecialty !== undefined) protocol.subspecialty = dto.subspecialty.trim();
      if (dto.active !== undefined) protocol.active = dto.active;
      if (content) {
        protocol.content = content;
        protocol.version += 1;
      }
      await protocol.save({ session });
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Protocol',
          entityId: protocol._id.toString(),
          before,
          after: toProtocol(protocol),
          metadata: { version: protocol.version, actor: actor.email },
        },
        session,
      );
      return toProtocol(protocol);
    });
  }

  async deactivate(id: string, actor: AuthenticatedUser): Promise<Protocol> {
    return this.update(id, { active: false }, actor);
  }

  private parseContent(raw: Record<string, unknown>) {
    const parsed = protocolContentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      );
    }
    return parsed.data;
  }
}
