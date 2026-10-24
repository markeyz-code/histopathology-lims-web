import { z } from 'zod';
import { DISCIPLINES, RESULT_TYPES, SEXES } from '../constants';
import { objectIdSchema } from './common';

export const referenceRangeSchema = z.object({
  low: z.number().nullable().optional(),
  high: z.number().nullable().optional(),
  sex: z.enum(SEXES).nullable().optional(),
  minAge: z.number().int().min(0).nullable().optional(),
  maxAge: z.number().int().min(0).nullable().optional(),
});

export const analyteDefinitionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-zA-Z0-9_]*$/, 'Analyte keys must be camelCase and start with a letter.'),
  name: z.string().trim().min(1).max(120),
  unit: z.string().trim().max(30).nullable().optional(),
  resultType: z.enum(RESULT_TYPES),
  decimals: z.number().int().min(0).max(6).optional(),
  options: z
    .array(
      z.object({
        value: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(120),
      }),
    )
    .max(100)
    .optional(),
  referenceRanges: z.array(referenceRangeSchema).max(20).default([]),
  criticalLow: z.number().nullable().optional(),
  criticalHigh: z.number().nullable().optional(),
  formula: z.string().trim().max(200).nullable().optional(),
  required: z.boolean().optional(),
});

export const testDefinitionSchema = z.object({
  discipline: z.enum(DISCIPLINES),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  specimenType: z.string().trim().min(1).max(80),
  method: z.string().trim().max(120).nullable().optional(),
  analytes: z.array(analyteDefinitionSchema).min(1).max(60),
  active: z.boolean().optional(),
});
export type TestDefinitionInput = z.infer<typeof testDefinitionSchema>;

export const testDefinitionQuerySchema = z.object({
  discipline: z.enum(DISCIPLINES).optional(),
  q: z.string().trim().max(80).optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const panelSchema = z.object({
  discipline: z.enum(DISCIPLINES),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  testCodes: z.array(z.string().trim().min(1).max(40)).min(1).max(40),
  active: z.boolean().optional(),
});

export const panelQuerySchema = z.object({
  discipline: z.enum(DISCIPLINES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const cumulativeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  disciplines: z.string().optional(),
});

export const terminologyIdSchema = objectIdSchema;
