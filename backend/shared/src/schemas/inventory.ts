import { z } from 'zod';
import {
  REAGENT_CATEGORIES,
  STAIN_QC_RESULTS,
  STAIN_RUN_STATUSES,
  STAIN_TYPES,
  STAIN_TYPES as STAIN_TYPE_VALUES,
} from '../constants';
import { objectIdSchema } from './common';

export const reagentLotSchema = z.object({
  name: z.string().trim().min(2, 'Name the reagent or antibody.').max(160),
  category: z.enum(REAGENT_CATEGORIES),
  vendor: z.string().trim().min(2, 'Vendor is required.').max(160),
  catalogNumber: z.string().trim().max(80).optional(),
  lotNumber: z.string().trim().min(1, 'Lot number is required.').max(80),
  storageLocation: z.string().trim().max(120).optional(),
  quantity: z.coerce.number().min(0).max(1_000_000),
  unit: z.string().trim().min(1).max(32),
  receivedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  openedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(2_000).optional(),
});
export type ReagentLotInput = z.infer<typeof reagentLotSchema>;

export const reagentLotQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  q: z.string().trim().max(120).optional(),
  category: z.enum(REAGENT_CATEGORIES).optional(),
  status: z.enum(['QUARANTINED', 'ACTIVE', 'EXPIRED', 'DEPLETED', 'REJECTED']).optional(),
  expiringWithinDays: z.coerce.number().int().min(0).max(365).optional(),
});
export type ReagentLotQuery = z.infer<typeof reagentLotQuerySchema>;

export const validateLotSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type ValidateLotInput = z.infer<typeof validateLotSchema>;

export const stainRunSchema = z
  .object({
    caseId: objectIdSchema,
    slideId: objectIdSchema.optional(),
    blockId: objectIdSchema.optional(),
    stainType: z.enum(STAIN_TYPE_VALUES),
    stainName: z.string().trim().min(1).max(160),
    equipment: z.string().trim().max(120).optional(),
    lots: z
      .array(
        z.object({
          lotId: objectIdSchema,
          quantityUsed: z.coerce.number().min(0).max(1_000_000),
        }),
      )
      .min(1, 'Select at least one reagent lot.'),
    notes: z.string().trim().max(2_000).optional(),
  })
  .refine((value) => Boolean(value.slideId || value.blockId), {
    message: 'A stain run must reference a slide or a block.',
    path: ['slideId'],
  });
export type StainRunInput = z.infer<typeof stainRunSchema>;

export const completeStainRunSchema = z.object({
  qcResult: z.enum(STAIN_QC_RESULTS),
  notes: z.string().trim().max(2_000).optional(),
});
export type CompleteStainRunInput = z.infer<typeof completeStainRunSchema>;

export const stainRunQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  caseId: objectIdSchema.optional(),
  status: z.enum(STAIN_RUN_STATUSES).optional(),
});
export type StainRunQuery = z.infer<typeof stainRunQuerySchema>;

void STAIN_TYPES;
