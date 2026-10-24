import { z } from 'zod';
import { LEAD_STATUSES, LEAD_TYPES } from '../constants';

export const leadCreateSchema = z.object({
  type: z.enum(LEAD_TYPES).default('DEMO'),
  organizationName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).nullable().optional(),
  role: z.string().trim().max(120).nullable().optional(),
  departments: z.array(z.string().trim().max(80)).max(10).optional(),
  monthlyVolume: z.string().trim().max(80).nullable().optional(),
  message: z.string().trim().max(2_000).nullable().optional(),
});

export const leadUpdateSchema = z.object({
  status: z.enum(LEAD_STATUSES),
});
