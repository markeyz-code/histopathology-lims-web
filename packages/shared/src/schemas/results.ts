import { z } from 'zod';
import { objectIdSchema } from './common';

export const resultValueInputSchema = z.object({
  analyteKey: z.string().trim().min(1).max(60),
  value: z.union([z.number(), z.string(), z.null()]),
});

export const createResultSchema = z.object({
  testRequestId: objectIdSchema,
});

export const updateResultSchema = z.object({
  values: z.array(resultValueInputSchema).min(1).max(100),
  comment: z.string().trim().max(2_000).nullable().optional(),
});

export const acknowledgeCriticalSchema = z.object({
  note: z.string().trim().min(3).max(1_000),
});

export const resultListQuerySchema = z.object({
  discipline: z
    .enum(['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'])
    .optional(),
  status: z.enum(['DRAFT', 'RESULTED', 'VERIFIED', 'RELEASED', 'CANCELLED']).optional(),
  caseId: objectIdSchema.optional(),
  patientId: objectIdSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
