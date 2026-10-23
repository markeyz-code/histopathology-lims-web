import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@lims/shared';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/auth.decorators';
import type { AuthenticatedUser } from '../auth/authenticated-user';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authentication required.');
    if (user.role === 'SUPER_ADMIN' || required.includes(user.role)) return true;

    throw new ForbiddenException('Your role cannot perform this action.');
  }
}
