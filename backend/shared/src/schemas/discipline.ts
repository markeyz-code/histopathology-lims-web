import { z } from 'zod';
import { DISCIPLINES, TEST_REQUEST_STATUSES } from '../constants';
import { objectIdSchema } from './common';

export const disciplineSchema = z.enum(DISCIPLINES);

export const testRequestSchema = z.object({
  discipline: disciplineSchema.default('HISTOPATHOLOGY'),
  code: z.string().trim().min(1).max(80).default('HISTO'),
  name: z.string().trim().min(1).max(160).default('Histopathology examination'),
});
export type TestRequestInput = z.infer<typeof testRequestSchema>;

export const testRequestQuerySchema = z.object({
  caseId: objectIdSchema.optional(),
  discipline: disciplineSchema.optional(),
  status: z.enum(TEST_REQUEST_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type TestRequestQuery = z.infer<typeof testRequestQuerySchema>;
