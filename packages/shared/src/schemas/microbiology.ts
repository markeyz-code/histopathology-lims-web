import { z } from 'zod';
import { AST_METHODS, BREAKPOINT_STANDARDS, ORGANISM_GRAMS } from '../constants';

export const organismSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  gram: z.enum(ORGANISM_GRAMS),
  whonetCode: z.string().trim().max(40).nullable().optional(),
  active: z.boolean().optional(),
});

export const antibioticSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  className: z.string().trim().min(1).max(80),
  whonetCode: z.string().trim().max(40).nullable().optional(),
  active: z.boolean().optional(),
});

export const breakpointSchema = z.object({
  standard: z.enum(BREAKPOINT_STANDARDS),
  version: z.string().trim().min(1).max(40),
  organismCode: z.string().trim().min(1).max(40),
  antibioticCode: z.string().trim().min(1).max(40),
  method: z.enum(AST_METHODS),
  susceptibleThreshold: z.number(),
  resistantThreshold: z.number(),
  unit: z.string().trim().max(30).nullable().optional(),
  firstLine: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const cultureSchema = z.object({
  testRequestId: z.string().trim().min(1),
  specimenType: z.string().trim().min(1).max(80),
  plateType: z.string().trim().max(80).nullable().optional(),
  media: z.string().trim().max(80).nullable().optional(),
  incubation: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
});

export const cultureUpdateSchema = z.object({
  status: z
    .enum(['PLATED', 'INCUBATING', 'READ', 'ID_DONE', 'AST_DONE', 'REPORTED', 'REJECTED'])
    .optional(),
  plateType: z.string().trim().max(80).nullable().optional(),
  media: z.string().trim().max(80).nullable().optional(),
  incubation: z.string().trim().max(120).nullable().optional(),
  organismCode: z.string().trim().max(40).nullable().optional(),
  colonyCount: z.string().trim().max(80).nullable().optional(),
  notes: z.string().trim().max(2_000).nullable().optional(),
  resistanceFlags: z.array(z.string().trim().max(30)).max(10).optional(),
});

export const susceptibilitySchema = z.object({
  isolateId: z.string().trim().min(1),
  antibioticCode: z.string().trim().min(1),
  method: z.enum(AST_METHODS),
  value: z.number(),
  notes: z.string().trim().max(500).nullable().optional(),
});
