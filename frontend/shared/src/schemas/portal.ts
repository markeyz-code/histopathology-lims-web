import { z } from 'zod';
import { NOTIFICATION_CHANNELS } from '../constants';

export const portalRequestSchema = z.object({
  labCode: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .transform((value) => value.toUpperCase()),
  email: z
    .string()
    .trim()
    .email()
    .max(160)
    .transform((value) => value.toLowerCase()),
});
export type PortalRequestInput = z.infer<typeof portalRequestSchema>;

export const portalVerifySchema = z
  .object({
    labCode: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .transform((value) => value.toUpperCase()),
    email: z
      .string()
      .trim()
      .email()
      .max(160)
      .transform((value) => value.toLowerCase()),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the six-digit code.')
      .optional(),
    token: z.string().trim().min(20).max(200).optional(),
  })
  .refine((value) => Boolean(value.code || value.token), {
    message: 'Enter the one-time code or use the magic link.',
    path: ['code'],
  });
export type PortalVerifyInput = z.infer<typeof portalVerifySchema>;

export const releaseReportSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type ReleaseReportInput = z.infer<typeof releaseReportSchema>;

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  channel: z.enum(NOTIFICATION_CHANNELS).optional(),
  status: z.enum(['QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED']).optional(),
  unreadOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => value === true || value === 'true'),
});
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
