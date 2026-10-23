import type { Role } from '@lims/shared';

export interface AuthenticatedUser {
  id: string;
  labId: string;
  name: string;
  email: string;
  role: Role;
  subspecialties: string[];
}

export interface AccessTokenPayload {
  sub: string;
  labId: string;
  name: string;
  email: string;
  role: Role;
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  labId: string;
  type: 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
}

const ROLE_SET = new Set<string>([
  'SUPER_ADMIN',
  'LAB_ADMIN',
  'RECEPTIONIST',
  'GROSSER',
  'TECHNOLOGIST',
  'PATHOLOGIST',
  'REFERRER',
]);

export function isAccessTokenPayload(value: unknown): value is AccessTokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'access' &&
    typeof candidate.sub === 'string' &&
    typeof candidate.labId === 'string' &&
    typeof candidate.role === 'string' &&
    ROLE_SET.has(candidate.role) &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string'
  );
}

export function isRefreshTokenPayload(value: unknown): value is RefreshTokenPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'refresh' &&
    typeof candidate.sub === 'string' &&
    typeof candidate.labId === 'string' &&
    typeof candidate.jti === 'string'
  );
}
