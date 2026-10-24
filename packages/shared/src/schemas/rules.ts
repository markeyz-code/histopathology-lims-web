import { z } from 'zod';
import { DISCIPLINES, RULE_ACTIONS, RULE_TRIGGERS } from '../constants';

const conditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      field: z.string().trim().min(1).max(160),
      op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'between', 'contains', 'exists']),
      value: z.unknown().optional(),
    }),
    z.object({ all: z.array(conditionSchema).min(1).max(50) }),
    z.object({ any: z.array(conditionSchema).min(1).max(50) }),
    z.object({ not: conditionSchema }),
  ]),
);

export const ruleSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1_000).nullable().optional(),
  discipline: z.enum(DISCIPLINES),
  testCodes: z.array(z.string().trim().min(1).max(40)).max(60).default([]),
  trigger: z.enum(RULE_TRIGGERS),
  priority: z.number().int().min(0).max(1_000).default(100),
  active: z.boolean().optional(),
  conditions: conditionSchema,
  actions: z
    .array(
      z.object({
        type: z.enum(RULE_ACTIONS),
        testCode: z.string().trim().max(40).optional(),
        message: z.string().trim().max(500).optional(),
        severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
      }),
    )
    .min(1)
    .max(10),
});

export const ruleQuerySchema = z.object({
  discipline: z.enum(DISCIPLINES).optional(),
  active: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
