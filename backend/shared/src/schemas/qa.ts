import { z } from 'zod';
import {
  QA_DISCREPANCY_CODES,
  QA_REVIEW_STATUSES,
  QA_REVIEW_TYPES,
  QA_SEVERITIES,
  REJECTION_REASON_CODES,
} from '../constants';
import { objectIdSchema } from './common';

export const qaReviewSchema = z.object({
  caseId: objectIdSchema,
  reportId: objectIdSchema.optional(),
  type: z.enum(QA_REVIEW_TYPES),
  reviewerId: objectIdSchema.optional(),
  reason: z.string().trim().min(5, 'Record why review is needed.').max(1_000),
  dueAt: z.string().datetime({ offset: true }).optional(),
});
export type QaReviewInput = z.infer<typeof qaReviewSchema>;

export const qaAssignSchema = z.object({
  reviewerId: objectIdSchema,
  dueAt: z.string().datetime({ offset: true }).optional(),
});
export type QaAssignInput = z.infer<typeof qaAssignSchema>;

export const qaStartSchema = z.object({
  findings: z.string().trim().min(10, 'Record your review findings.').max(5_000).optional(),
});
export type QaStartInput = z.infer<typeof qaStartSchema>;

export const qaCompleteSchema = z.object({
  outcome: z.enum(['AGREED', 'DISCREPANT']),
  reviewDiagnosis: z.string().trim().max(5_000).optional(),
  disagreementCode: z.enum(QA_DISCREPANCY_CODES).optional(),
  severity: z.enum(QA_SEVERITIES).optional(),
  findings: z.string().trim().min(10, 'Record the peer-review findings.').max(5_000),
  actionPlan: z.string().trim().max(2_000).optional(),
});
export type QaCompleteInput = z.infer<typeof qaCompleteSchema>;

export const qaQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  status: z.enum(QA_REVIEW_STATUSES).optional(),
  type: z.enum(QA_REVIEW_TYPES).optional(),
  reviewerId: objectIdSchema.optional(),
  mine: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => value === true || value === 'true'),
});
export type QaQuery = z.infer<typeof qaQuerySchema>;

export const rejectWithCodeSchema = z.object({
  reasonCode: z.enum(REJECTION_REASON_CODES),
  reason: z.string().trim().min(5, 'Add a short note explaining the rejection.').max(1_000),
});
export type RejectWithCodeInput = z.infer<typeof rejectWithCodeSchema>;
