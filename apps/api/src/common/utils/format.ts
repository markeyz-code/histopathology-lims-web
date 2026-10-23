import type { Paginated } from '@lims/shared';

export function buildPaginated<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toIsoRequired(value: Date | null | undefined): string {
  return (value ?? new Date()).toISOString();
}

export function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const SENSITIVE_KEYS = new Set(['passwordHash', 'password', 'refreshTokenHash', 'refreshToken']);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) continue;
      result[key] = redact(item);
    }
    return result;
  }
  return value;
}

/** JSON-safe, credential-free snapshot for audit before/after values. */
export function auditSnapshot(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  let plain: unknown = value;
  if (typeof value === 'object' && value !== null && 'toObject' in value) {
    const toObject = (value as { toObject?: () => unknown }).toObject;
    if (typeof toObject === 'function') plain = toObject.call(value);
  }
  const serialized = JSON.parse(JSON.stringify(plain)) as unknown;
  const redacted = redact(serialized);
  return redacted !== null && typeof redacted === 'object'
    ? (redacted as Record<string, unknown>)
    : { value: redacted };
}
