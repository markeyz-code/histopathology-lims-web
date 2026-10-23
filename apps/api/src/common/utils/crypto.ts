import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 11);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function makeBarcode(prefix: string): string {
  return `${prefix}-${ulid()}`;
}

export function randomVerificationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = createHash('sha256').update(ulid()).digest();
  let code = '';
  for (let index = 0; index < 10; index += 1) {
    const byte = bytes[index] ?? 0;
    code += alphabet[byte % alphabet.length];
  }
  return code;
}
