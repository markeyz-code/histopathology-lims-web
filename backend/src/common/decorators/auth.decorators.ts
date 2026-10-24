import { SetMetadata } from '@nestjs/common';
import type { Role } from '@lims/shared';

export const IS_PUBLIC_KEY = 'lims:isPublic';
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'lims:roles';
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
