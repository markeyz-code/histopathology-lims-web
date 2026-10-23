import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { verify } from 'jsonwebtoken';
import type { AuthResponse, Lab, User } from '@lims/shared';
import { parseTtlSeconds } from '../../common/config/env';
import {
  isRefreshTokenPayload,
  type AccessTokenPayload,
  type AuthenticatedUser,
  type RefreshTokenPayload,
} from '../../common/auth/authenticated-user';
import { runWithTenant } from '../../common/context/tenant-context';
import { hashToken, verifyPassword } from '../../common/utils/crypto';
import { toLab, toUser } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';
import type { LoginDto } from './dto/auth.dto';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MeResponse {
  user: User;
  lab: Lab;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const lab = await this.labModel
      .findOne({ code: dto.labCode.toUpperCase(), active: true })
      .exec();
    if (!lab) throw new UnauthorizedException('Invalid laboratory code, email or password.');

    const labId = lab._id.toString();
    return runWithTenant({ labId }, async () => {
      const user = await this.userModel
        .findOne({ email: dto.email.toLowerCase() })
        .select('+passwordHash')
        .exec();
      if (!user || !user.active) {
        throw new UnauthorizedException('Invalid laboratory code, email or password.');
      }
      const valid = await verifyPassword(dto.password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('Invalid laboratory code, email or password.');
      }

      const tokens = await this.signTokens(user);
      user.refreshTokenHash = hashToken(tokens.refreshToken);
      user.lastLoginAt = new Date();
      await user.save();

      await this.audit.record({
        action: 'LOGIN',
        entityType: 'User',
        entityId: user._id.toString(),
        metadata: { labCode: lab.code },
        actor: { userId: user._id.toString(), userName: user.name, userRole: user.role },
      });

      return {
        ...tokens,
        user: toUser(user),
        lab: toLab(lab),
      };
    });
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    let payload: RefreshTokenPayload;
    try {
      const raw = verify(refreshToken, this.config.getOrThrow<string>('JWT_REFRESH_SECRET'));
      if (!isRefreshTokenPayload(raw)) throw new Error('Wrong token type.');
      payload = raw;
    } catch {
      throw new UnauthorizedException('Session expired. Sign in again.');
    }

    return runWithTenant({ labId: payload.labId }, async () => {
      const user = await this.userModel.findById(payload.sub).select('+refreshTokenHash').exec();
      if (!user || !user.active || !user.refreshTokenHash) {
        throw new UnauthorizedException('Session expired. Sign in again.');
      }
      const providedHash = hashToken(refreshToken);
      const expected = Buffer.from(user.refreshTokenHash, 'utf8');
      const provided = Buffer.from(providedHash, 'utf8');
      if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        throw new UnauthorizedException('Session expired. Sign in again.');
      }

      const tokens = await this.signTokens(user);
      user.refreshTokenHash = hashToken(tokens.refreshToken);
      await user.save();

      const lab = await this.labModel.findById(user.labId).exec();
      if (!lab) throw new UnauthorizedException('Laboratory is no longer available.');

      return { ...tokens, user: toUser(user), lab: toLab(lab) };
    });
  }

  async logout(user: AuthenticatedUser): Promise<{ success: true }> {
    const stored = await this.userModel.findById(user.id).exec();
    if (stored) {
      stored.refreshTokenHash = null;
      await stored.save();
    }
    await this.audit.record({
      action: 'LOGOUT',
      entityType: 'User',
      entityId: user.id,
    });
    return { success: true };
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new UnauthorizedException('Account not found.');
    const lab = await this.labModel.findById(user.labId).exec();
    if (!lab) throw new UnauthorizedException('Laboratory is no longer available.');
    return { user: toUser(user), lab: toLab(lab) };
  }

  private async signTokens(user: UserEntity): Promise<TokenPair> {
    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    const accessTtl = parseTtlSeconds(this.config.getOrThrow<string>('JWT_ACCESS_TTL'), 900);
    const refreshTtl = parseTtlSeconds(this.config.getOrThrow<string>('JWT_REFRESH_TTL'), 604_800);
    const labId = user.labId.toString();

    const accessPayload: AccessTokenPayload = {
      sub: user._id.toString(),
      labId,
      name: user.name,
      email: user.email,
      role: user.role,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user._id.toString(),
      labId,
      type: 'refresh',
      jti: randomUUID(),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, { secret: accessSecret, expiresIn: accessTtl }),
      this.jwt.signAsync(refreshPayload, { secret: refreshSecret, expiresIn: refreshTtl }),
    ]);

    return { accessToken, refreshToken, expiresIn: accessTtl };
  }
}
