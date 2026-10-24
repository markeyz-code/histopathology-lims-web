import { z } from 'zod';
import { SEXES } from '../constants';
import { DATE_REGEX } from './common';

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(max).optional(),
  );

export const nextOfKinSchema = z.object({
  name: optionalText(150),
  phone: optionalText(40),
  relationship: optionalText(80),
});
export type NextOfKinInput = z.infer<typeof nextOfKinSchema>;

export const patientInputSchema = z.object({
  mrn: optionalText(40),
  firstName: z.string().trim().min(1, 'First name is required.').max(100),
  lastName: z.string().trim().min(1, 'Surname is required.').max(100),
  sex: z.enum(SEXES),
  dateOfBirth: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.string().regex(DATE_REGEX, 'Use YYYY-MM-DD.').optional(),
  ),
  age: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().int().min(0, 'Age cannot be negative.').max(130).optional(),
  ),
  phone: optionalText(40),
  email: z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.string().trim().email('Enter a valid email address.').max(160).optional(),
  ),
  address: optionalText(500),
  nationalId: optionalText(60),
  nextOfKin: nextOfKinSchema.optional(),
});
export type PatientInput = z.infer<typeof patientInputSchema>;

export const patientListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
});
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
