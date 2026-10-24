import { z } from 'zod';
import { DISCIPLINES, QC_LEVELS } from '../constants';

export const qcMaterialSchema = z.object({
  discipline: z.enum(DISCIPLINES),
  name: z.string().trim().min(1).max(160),
  lotNumber: z.string().trim().min(1).max(80),
  level: z.enum(QC_LEVELS),
  testCode: z.string().trim().min(1).max(40),
  analyteKey: z.string().trim().min(1).max(60),
  targetMean: z.number(),
  targetSd: z.number().positive(),
  unit: z.string().trim().max(30).nullable().optional(),
  active: z.boolean().optional(),
});

export const qcRunSchema = z.object({
  materialId: z.string().trim().min(1),
  values: z.array(z.number()).min(2).max(30),
  comment: z.string().trim().max(1_000).nullable().optional(),
});

export const qcQuerySchema = z.object({
  discipline: z.enum(DISCIPLINES).optional(),
  materialId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
