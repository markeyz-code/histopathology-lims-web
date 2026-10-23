import type { Role } from '@lims/shared';
import { currentTenant } from '../context/tenant-context';
import { getRequestContext } from '../context/request-context';

export interface Actor {
  userId: string | null;
  userName: string;
  userRole: Role | null;
}

export function currentActor(fallbackName = 'System'): Actor {
  const tenant = currentTenant();
  return {
    userId: tenant?.userId ?? null,
    userName: tenant?.userName ?? fallbackName,
    userRole: tenant?.userRole ?? null,
  };
}

export function requestAuditContext(): {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
} {
  const request = getRequestContext();
  return {
    ip: request?.ip ?? null,
    userAgent: request?.userAgent ?? null,
    requestId: request?.requestId ?? null,
  };
}
