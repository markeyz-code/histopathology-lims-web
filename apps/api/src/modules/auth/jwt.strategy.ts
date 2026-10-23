import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { PassportStrategy } from '@nestjs/passport';
import { Model } from 'mongoose';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { isAccessTokenPayload } from '../../common/auth/authenticated-user';
import { runWithTenant } from '../../common/context/tenant-context';
import { UserModelName, type UserEntity } from '../users/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: unknown): Promise<AuthenticatedUser> {
    if (!isAccessTokenPayload(payload)) {
      throw new UnauthorizedException('Invalid access token.');
    }

    const user = await runWithTenant({ labId: payload.labId }, () =>
      this.userModel.findById(payload.sub).exec(),
    );
    if (!user || !user.active || user.labId.toString() !== payload.labId) {
      throw new UnauthorizedException('Account is inactive or unavailable.');
    }

    return {
      id: user._id.toString(),
      labId: user.labId.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      subspecialties: user.subspecialties,
    };
  }
}
