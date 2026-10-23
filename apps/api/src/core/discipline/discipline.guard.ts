import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isClinicalRole, type Discipline } from '@lims/shared';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { DISCIPLINE_KEY } from './discipline.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/auth.decorators';

@Injectable()
export class DisciplineGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<Discipline[]>(DISCIPLINE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authentication required.');

    const enabled = user.labEnabledDisciplines ?? ['HISTOPATHOLOGY'];
    for (const discipline of required) {
      if (!enabled.includes(discipline)) {
        throw new ForbiddenException(
          `${discipline.replace('_', ' ').toLowerCase()} is not enabled for this laboratory.`,
        );
      }
      if (user.role === 'SUPER_ADMIN' || user.role === 'LAB_ADMIN') continue;
      if (isClinicalRole(user.role)) {
        const assigned =
          user.disciplines.length > 0 ? user.disciplines : (['HISTOPATHOLOGY'] as Discipline[]);
        if (!assigned.includes(discipline)) {
          throw new ForbiddenException('You are not assigned to this discipline.');
        }
      }
    }
    return true;
  }
}
