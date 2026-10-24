import { z } from 'zod';

export const collectionCentreSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(160),
  address: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  homeCollection: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const consignmentSchema = z.object({
  centreId: z.string().trim().min(1),
  testRequestIds: z.array(z.string().trim().min(1)).min(1).max(200),
  riderName: z.string().trim().max(120).nullable().optional(),
  riderPhone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const receiveConsignmentSchema = z.object({
  accepted: z.boolean(),
  rejectionReason: z.string().trim().max(500).nullable().optional(),
});
