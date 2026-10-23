import { z } from 'zod';
import { AUDIT_ACTIONS, ROLES } from '../constants';
import { validateAccessionFormat } from '../formats';
import { objectIdSchema } from './common';

const optionalTrimmed = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Enter the staff member’s name.').max(150),
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(160)
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(128)
    .regex(/[A-Za-z]/, 'Include a letter.')
    .regex(/\d/, 'Include a number.'),
  role: z.enum(ROLES),
  phone: optionalTrimmed(40),
  subspecialties: z.array(z.string().trim().max(80)).max(20).default([]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  role: z.enum(ROLES).optional(),
  phone: optionalTrimmed(40),
  active: z.boolean().optional(),
  subspecialties: z.array(z.string().trim().max(80)).max(20).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(128)
    .regex(/[A-Za-z]/, 'Include a letter.')
    .regex(/\d/, 'Include a number.'),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(ROLES).optional(),
  phone: optionalTrimmed(40),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  q: z.string().trim().max(120).optional(),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const letterheadSchema = z.object({
  phone: optionalTrimmed(60),
  email: optionalTrimmed(160),
  website: optionalTrimmed(200),
  pathologistName: optionalTrimmed(160),
  pathologistTitle: optionalTrimmed(160),
  qualifications: optionalTrimmed(200),
  signatureText: optionalTrimmed(300),
  footerNote: optionalTrimmed(500),
});
export type LetterheadInput = z.infer<typeof letterheadSchema>;

export const updateLabSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  address: z.string().trim().max(500).optional(),
  phone: optionalTrimmed(60),
  email: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().email('Enter a valid email address.').max(160).optional(),
  ),
  accessionPrefix: z
    .string()
    .trim()
    .min(2)
    .max(6)
    .regex(/^[A-Za-z0-9]+$/, 'Use 2–6 letters or digits.')
    .transform((value) => value.toUpperCase())
    .optional(),
  accessionFormat: z
    .string()
    .trim()
    .max(48)
    .refine((value) => validateAccessionFormat(value) === null, {
      message: 'Use tokens {PREFIX}, {YYYY}, {YY} and a required {SEQ} or {SEQ:n}.',
    })
    .optional(),
  tatHours: z
    .object({
      FROZEN: z.coerce.number().min(0.25).max(168),
      URGENT: z.coerce.number().min(0.5).max(720),
      ROUTINE: z.coerce.number().min(1).max(1_440),
    })
    .optional(),
  tatWarningPercent: z.coerce.number().int().min(50).max(95).optional(),
  timezone: z.string().trim().max(80).optional(),
  qaSamplingPercent: z.coerce.number().int().min(0).max(100).optional(),
  currency: z.string().trim().length(3).optional(),
  letterhead: letterheadSchema.optional(),
});
export type UpdateLabInput = z.infer<typeof updateLabSchema>;

export const auditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(60).optional(),
  userId: objectIdSchema.optional(),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
});
export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

export const protocolListQuerySchema = z.object({
  subspecialty: z.string().trim().max(80).optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});
export type ProtocolListQuery = z.infer<typeof protocolListQuerySchema>;

export const worklistQuerySchema = z.object({
  status: z.enum(['RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW', 'AMENDED']).optional(),
  priority: z.enum(['ROUTINE', 'URGENT', 'FROZEN']).optional(),
  assigned: z.enum(['me', 'unassigned', 'all']).default('all'),
  subspecialty: z.string().trim().max(80).optional(),
  pathologistId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type WorklistQuery = z.infer<typeof worklistQuerySchema>;

export const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
