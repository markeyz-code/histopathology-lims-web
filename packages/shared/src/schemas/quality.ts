import { z } from 'zod';
import {
  CAPA_STATUSES,
  EQUIPMENT_STATUSES,
  NC_SEVERITIES,
  NC_STATUSES,
  SEND_OUT_STATUSES,
} from '../constants';

export const equipmentSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().max(80).nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  status: z.enum(EQUIPMENT_STATUSES).optional(),
  lastCalibrationAt: z.string().optional(),
  nextCalibrationAt: z.string().optional(),
  active: z.boolean().optional(),
});

export const temperatureLogSchema = z.object({
  temperature: z.number(),
  unit: z.string().trim().max(10).default('°C'),
  minAllowed: z.number().nullable().optional(),
  maxAllowed: z.number().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const nonConformanceSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(3_000),
  category: z.string().trim().min(1).max(80),
  severity: z.enum(NC_SEVERITIES),
  assignedToId: z.string().trim().optional(),
  dueAt: z.string().optional(),
});

export const nonConformanceUpdateSchema = z.object({
  status: z.enum(NC_STATUSES).optional(),
  severity: z.enum(NC_SEVERITIES).optional(),
  rootCause: z.string().trim().max(2_000).nullable().optional(),
  assignedToId: z.string().trim().nullable().optional(),
});

export const capaSchema = z.object({
  action: z.string().trim().min(3).max(1_000),
  owner: z.string().trim().max(120).nullable().optional(),
  dueAt: z.string().optional(),
  status: z.enum(CAPA_STATUSES).optional(),
});

export const sendOutSchema = z.object({
  testRequestId: z.string().trim().min(1),
  referenceLab: z.string().trim().min(2).max(160),
  reason: z.string().trim().max(500).nullable().optional(),
  courier: z.string().trim().max(120).nullable().optional(),
  trackingNumber: z.string().trim().max(120).nullable().optional(),
});

export const sendOutUpdateSchema = z.object({
  status: z.enum(SEND_OUT_STATUSES).optional(),
  resultSummary: z.string().trim().max(3_000).nullable().optional(),
});
