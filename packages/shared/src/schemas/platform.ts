import { z } from 'zod';
import {
  DISCIPLINES,
  ORGANIZATION_STATUSES,
  ORGANIZATION_TYPES,
  SUBSCRIPTION_PLANS,
} from '../constants';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const organizationCreateSchema = z.object({
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(200),
  type: z.enum(ORGANIZATION_TYPES),
  country: z.string().trim().min(2).max(80).default('Nigeria'),
  state: optionalText(80),
  city: optionalText(80),
  address: optionalText(300),
  phone: optionalText(40),
  email: z.string().trim().email().max(160).nullable().optional(),
  website: optionalText(160),
  plan: z.enum(SUBSCRIPTION_PLANS).optional(),
  seats: z.number().int().min(1).max(10_000).optional(),
  trialDays: z.number().int().min(1).max(365).optional(),
  notes: optionalText(1_000),
});

export const administratorSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).nullable().optional(),
});

export const labProvisionSchema = z.object({
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(200),
  address: optionalText(300),
  phone: optionalText(40),
  email: z.string().trim().email().max(160).nullable().optional(),
  enabledDisciplines: z.array(z.enum(DISCIPLINES)).min(1),
  accessionPrefix: z.string().trim().min(1).max(8).optional(),
  timezone: z.string().trim().max(60).optional(),
  currency: z.string().trim().length(3).optional(),
  qaSamplingPercent: z.number().int().min(0).max(100).optional(),
  administrator: administratorSchema.optional(),
});

export const onboardingSchema = z.object({
  organization: organizationCreateSchema,
  lab: labProvisionSchema,
  administrator: administratorSchema,
});

export const onboardingAdminSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.string().trim().email().max(160),
  phone: z.string().trim().max(40).nullable().optional(),
});

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  status: z.enum(ORGANIZATION_STATUSES).optional(),
  plan: z.enum(SUBSCRIPTION_PLANS).optional(),
  seats: z.number().int().min(1).max(10_000).optional(),
  notes: optionalText(1_000),
  email: z.string().trim().email().max(160).nullable().optional(),
  phone: optionalText(40),
});

export const labOrganizationSchema = z.object({
  organizationId: z.string().trim().nullable(),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: z.string().min(8).max(128),
});

export const platformLabQuerySchema = z.object({
  organizationId: z.string().optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'ONBOARDING']).optional(),
});
