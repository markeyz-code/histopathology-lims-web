import { z } from 'zod';
import { STATIONS, SYNC_MUTATION_TYPES } from '../constants';
import { objectIdSchema } from './common';

export const syncMutationSchema = z.object({
  id: z.string().min(8).max(80),
  type: z.enum(SYNC_MUTATION_TYPES),
  payload: z.record(z.unknown()),
  createdAt: z.string().datetime({ offset: true }).optional(),
});
export type SyncMutationInput = z.infer<typeof syncMutationSchema>;

export const syncBatchSchema = z.object({
  mutations: z.array(syncMutationSchema).max(100),
});
export type SyncBatchInput = z.infer<typeof syncBatchSchema>;

export const scanIdempotencySchema = z.object({
  barcode: z.string().trim().min(3).max(128),
  station: z.enum(STATIONS),
  eventType: z.enum(['REJECTED', 'RECUT_REQUESTED']).optional(),
  reason: z.string().trim().max(1_000).optional(),
  reasonCode: z.string().trim().max(60).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ScanIdempotencyInput = z.infer<typeof scanIdempotencySchema>;

void objectIdSchema;
