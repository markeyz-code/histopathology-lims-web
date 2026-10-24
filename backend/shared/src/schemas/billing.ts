import { z } from 'zod';
import { INVOICE_STATUSES, PAYER_TYPES, PAYMENT_PROVIDERS } from '../constants';
import { objectIdSchema } from './common';

export const invoiceItemSchema = z.object({
  description: z.string().trim().min(2).max(200),
  quantity: z.coerce.number().min(0.01).max(10_000),
  unitPrice: z.coerce.number().min(0).max(100_000_000),
  category: z.string().trim().min(1).max(60).default('PROFESSIONAL'),
});
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const createInvoiceSchema = z.object({
  caseId: objectIdSchema,
  payerType: z.enum(PAYER_TYPES),
  hmoName: z.string().trim().max(160).optional(),
  hmoCode: z.string().trim().max(80).optional(),
  authorizationNumber: z.string().trim().max(80).optional(),
  items: z.array(invoiceItemSchema).min(1).max(50),
  discount: z.coerce.number().min(0).max(100_000_000).default(0),
  currency: z.string().trim().length(3).default('NGN'),
  dueAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().trim().max(2_000).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const invoiceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  status: z.enum(INVOICE_STATUSES).optional(),
  payerType: z.enum(PAYER_TYPES).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  q: z.string().trim().max(120).optional(),
});
export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;

export const initializePaymentSchema = z.object({
  provider: z.enum(PAYMENT_PROVIDERS),
  amount: z.coerce.number().min(1).max(100_000_000).optional(),
});
export type InitializePaymentInput = z.infer<typeof initializePaymentSchema>;

export const recordManualPaymentSchema = z.object({
  provider: z.enum(['CASH', 'TRANSFER', 'HMO']),
  amount: z.coerce.number().min(1).max(100_000_000),
  reference: z.string().trim().min(1).max(120),
  note: z.string().trim().max(500).optional(),
});
export type RecordManualPaymentInput = z.infer<typeof recordManualPaymentSchema>;

export const claimQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  format: z.enum(['csv', 'json']).default('csv'),
  hmoName: z.string().trim().max(160).optional(),
});
export type ClaimQuery = z.infer<typeof claimQuerySchema>;
