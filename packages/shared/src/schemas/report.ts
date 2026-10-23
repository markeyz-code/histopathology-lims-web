import { z } from 'zod';
import { REPORT_STATUSES } from '../constants';
import { objectIdSchema } from './common';
import { reportDataSchema } from './report-data';

export const createReportSchema = z.object({
  protocolId: objectIdSchema,
});
export type CreateReportInput = z.infer<typeof createReportSchema>;

export const updateReportSchema = z.object({
  data: reportDataSchema,
});
export type UpdateReportInput = z.infer<typeof updateReportSchema>;

export const signOutReportSchema = z.object({
  statement: z.string().trim().max(500).optional(),
});
export type SignOutReportInput = z.infer<typeof signOutReportSchema>;

export const amendReportSchema = z.object({
  reason: z.string().trim().min(10, 'Give a clear reason for the amendment.').max(2_000),
  data: reportDataSchema.optional(),
});
export type AmendReportInput = z.infer<typeof amendReportSchema>;

export const reportListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(REPORT_STATUSES).optional(),
  q: z.string().trim().max(120).optional(),
});
export type ReportListQuery = z.infer<typeof reportListQuerySchema>;
