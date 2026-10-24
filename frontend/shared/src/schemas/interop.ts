import { z } from 'zod';
import { CODING_SYSTEMS } from '../constants';
import { objectIdSchema } from './common';

export const wsiLinkSchema = z.object({
  url: z.string().url().max(2_000),
  viewerUrl: z.string().url().max(2_000).optional(),
  scanner: z.string().trim().max(120).optional(),
  magnification: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1_000).optional(),
});
export type WsiLinkInput = z.infer<typeof wsiLinkSchema>;

export const wsiWebhookSchema = z.object({
  labCode: z.string().trim().min(2).max(32).optional(),
  barcode: z.string().trim().min(3).max(128),
  url: z.string().url().max(2_000),
  status: z.enum(['LINKED', 'PROCESSING', 'FAILED']).default('LINKED'),
  scanner: z.string().trim().max(120).optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type WsiWebhookInput = z.infer<typeof wsiWebhookSchema>;

export const terminologyQuerySchema = z.object({
  system: z.enum(CODING_SYSTEMS).optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type TerminologyQuery = z.infer<typeof terminologyQuerySchema>;

export const terminologyValidateSchema = z.object({
  system: z.enum(CODING_SYSTEMS),
  code: z.string().trim().min(1).max(40),
});
export type TerminologyValidateInput = z.infer<typeof terminologyValidateSchema>;

export const reportCodingSchema = z.object({
  snomedCode: z.string().trim().max(40).nullable().optional(),
  snomedDisplay: z.string().trim().max(240).nullable().optional(),
  icdo3MorphologyCode: z.string().trim().max(40).nullable().optional(),
  icdo3MorphologyDisplay: z.string().trim().max(240).nullable().optional(),
  icdo3TopographyCode: z.string().trim().max(40).nullable().optional(),
  icdo3TopographyDisplay: z.string().trim().max(240).nullable().optional(),
});
export type ReportCodingInput = z.infer<typeof reportCodingSchema>;

export const hl7MessageSchema = z.object({
  message: z.string().min(10).max(500_000),
});
export type Hl7MessageInput = z.infer<typeof hl7MessageSchema>;

export const hl7OrderSchema = z.object({
  patient: objectIdSchema.optional(),
  labCode: z.string().trim().max(32).optional(),
});
