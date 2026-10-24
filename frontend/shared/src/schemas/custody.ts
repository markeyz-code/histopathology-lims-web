import { z } from 'zod';
import { STATIONS } from '../constants';

export const scanSchema = z.object({
  barcode: z
    .string()
    .trim()
    .min(3, 'Scan or type a barcode.')
    .max(128)
    .transform((value) => value.toUpperCase().replace(/\s+/g, '')),
  station: z.enum(STATIONS),
  eventType: z.enum(['REJECTED', 'RECUT_REQUESTED']).optional(),
  reason: z.string().trim().max(1_000).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type ScanInput = z.infer<typeof scanSchema>;

export const locatorQuerySchema = z.object({
  q: z.string().trim().max(128).optional(),
});
export type LocatorQuery = z.infer<typeof locatorQuerySchema>;
