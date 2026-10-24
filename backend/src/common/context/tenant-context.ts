import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@lims/shared';

export interface TenantStore {
  /** The lab that owns every document touched by this async call chain. */
  labId: string;
  userId?: string;
  userName?: string;
  userRole?: Role;
  /**
   * Internal, explicitly-scoped operations only (public report verification,
   * seeding, migrations). Never set from user input.
   */
  system?: boolean;
  reason?: string;
}

export class TenantContextMissingError extends Error {
  constructor() {
    super('Tenant context is missing. Refusing to run an unscoped database operation.');
    this.name = 'TenantContextMissingError';
  }
}

const storage = new AsyncLocalStorage<TenantStore>();

export function runWithTenant<T>(store: TenantStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function runWithSystemTenant<T>(reason: string, labId: string, fn: () => T): T {
  return storage.run({ labId, system: true, reason }, fn);
}

export function currentTenant(): TenantStore | undefined {
  return storage.getStore();
}

export function requireTenant(): TenantStore {
  const store = storage.getStore();
  if (!store) throw new TenantContextMissingError();
  return store;
}
