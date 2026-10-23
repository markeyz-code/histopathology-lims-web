import { z } from 'zod';
import {
  CASE_STATUSES,
  LATERALITIES,
  MAX_BLOCK_COUNT,
  MAX_SLIDE_COUNT,
  PRIORITIES,
  STAIN_TYPES,
} from '../constants';
import { patientInputSchema } from './patient';
import { objectIdSchema } from './common';

export const referringClinicianSchema = z.object({
  name: z.string().trim().min(2, 'Referring clinician is required.').max(160),
  facility: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || undefined),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => value || undefined),
  email: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
      'Enter a valid email address.',
    ),
});
export type ReferringClinicianInput = z.infer<typeof referringClinicianSchema>;

export const specimenInputSchema = z.object({
  specimenType: z.string().trim().min(2, 'Specimen type is required.').max(120),
  site: z.string().trim().min(1, 'Anatomical site is required.').max(200),
  laterality: z.enum(LATERALITIES).optional(),
  description: z
    .string()
    .trim()
    .max(2_000)
    .optional()
    .transform((value) => value || undefined),
  collectedAt: z.string().datetime({ offset: true }).optional(),
});
export type SpecimenInput = z.infer<typeof specimenInputSchema>;

export const accessionSchema = z.object({
  patient: patientInputSchema,
  referringClinician: referringClinicianSchema,
  clinicalHistory: z
    .string()
    .trim()
    .min(5, 'Record the clinical history (at least 5 characters).')
    .max(5_000),
  clinicalDiagnosis: z
    .string()
    .trim()
    .max(2_000)
    .optional()
    .transform((value) => value || undefined),
  priority: z.enum(PRIORITIES),
  discipline: z
    .enum(['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'])
    .default('HISTOPATHOLOGY'),
  testCode: z.string().trim().max(80).optional(),
  testName: z.string().trim().max(160).optional(),
  subspecialty: z.string().trim().max(80).optional(),
  assignedPathologistId: objectIdSchema.optional(),
  specimens: z
    .array(specimenInputSchema)
    .min(1, 'Add at least one specimen.')
    .max(20, 'A single accession can contain at most 20 specimens.'),
});
export type AccessionInput = z.infer<typeof accessionSchema>;

export const updateCaseSchema = z.object({
  clinicalHistory: z.string().trim().min(5).max(5_000).optional(),
  clinicalDiagnosis: z.string().trim().max(2_000).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  subspecialty: z.string().trim().max(80).nullable().optional(),
});
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;

export const assignCaseSchema = z.object({
  pathologistId: objectIdSchema.nullable(),
});
export type AssignCaseInput = z.infer<typeof assignCaseSchema>;

export const caseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.enum(CASE_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  pathologistId: objectIdSchema.optional(),
  discipline: z
    .enum(['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'])
    .optional(),
  subspecialty: z.string().trim().max(80).optional(),
  from: z.string().trim().max(40).optional(),
  to: z.string().trim().max(40).optional(),
});
export type CaseListQuery = z.infer<typeof caseListQuerySchema>;

export const grossBlockSchema = z.object({
  specimenId: objectIdSchema,
  grossDescription: z.string().trim().min(5, 'Describe the gross specimen.').max(10_000),
  blockCount: z.coerce.number().int().min(1).max(MAX_BLOCK_COUNT),
  blockDescriptions: z.array(z.string().trim().max(2_000)).max(MAX_BLOCK_COUNT).optional(),
});
export type GrossBlockInput = z.infer<typeof grossBlockSchema>;

export const cutSlidesSchema = z
  .object({
    blockId: objectIdSchema,
    count: z.coerce.number().int().min(1).max(MAX_SLIDE_COUNT),
    stainType: z.enum(STAIN_TYPES).default('H_AND_E'),
    specialStain: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(2_000).optional(),
  })
  .refine((value) => value.stainType === 'H_AND_E' || Boolean(value.specialStain), {
    path: ['specialStain'],
    message: 'Name the special stain or antibody.',
  });
export type CutSlidesInput = z.infer<typeof cutSlidesSchema>;

export const stainRequestSchema = z.object({
  blockId: objectIdSchema,
  stainType: z.enum(['SPECIAL', 'IMMUNOHISTOCHEMISTRY']),
  specialStain: z.string().trim().min(1, 'Name the stain or antibody.').max(160),
  reason: z.string().trim().min(5, 'Record why the extra stain is needed.').max(1_000),
});
export type StainRequestInput = z.infer<typeof stainRequestSchema>;

export const rejectSpecimenSchema = z.object({
  reasonCode: z
    .enum([
      'MISLABELLED',
      'WRONG_CONTAINER',
      'FIXATION_DELAY',
      'INSUFFICIENT_TISSUE',
      'CONTAMINATION',
      'BROKEN_SLIDE',
      'LOST_IN_PROCESSING',
      'UNREPRESENTATIVE',
      'OTHER',
    ])
    .default('OTHER'),
  reason: z.string().trim().min(5, 'Record a rejection reason.').max(1_000),
});
export type RejectSpecimenInput = z.infer<typeof rejectSpecimenSchema>;
