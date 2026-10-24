import { Schema, Types } from 'mongoose';
import {
  CAPA_STATUSES,
  EQUIPMENT_STATUSES,
  NC_SEVERITIES,
  NC_STATUSES,
  SEND_OUT_STATUSES,
  type CapaStatus,
  type EquipmentStatus,
  type NcSeverity,
  type NcStatus,
  type SendOutStatus,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const EquipmentModelName = 'Equipment';
export const TemperatureLogModelName = 'TemperatureLog';
export const NonConformanceModelName = 'NonConformance';
export const CapaActionModelName = 'CapaAction';
export const SendOutModelName = 'SendOut';

export interface EquipmentEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  code: string;
  name: string;
  type: string;
  serialNumber: string | null;
  location: string | null;
  status: EquipmentStatus;
  lastCalibrationAt: Date | null;
  nextCalibrationAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const EquipmentSchema = new Schema<EquipmentEntity>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: { type: String, required: true, trim: true, maxlength: 80 },
    serialNumber: { type: String, trim: true, maxlength: 80, default: null },
    location: { type: String, trim: true, maxlength: 160, default: null },
    status: { type: String, enum: EQUIPMENT_STATUSES, default: 'ACTIVE' },
    lastCalibrationAt: { type: Date, default: null },
    nextCalibrationAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('equipment'),
);
EquipmentSchema.plugin(tenantPlugin);
EquipmentSchema.index({ labId: 1, code: 1 }, { unique: true });

export interface TemperatureLogEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  equipmentId: Types.ObjectId;
  temperature: number;
  unit: string;
  minAllowed: number | null;
  maxAllowed: number | null;
  inRange: boolean;
  recordedBy: Types.ObjectId | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export const TemperatureLogSchema = new Schema<TemperatureLogEntity>(
  {
    equipmentId: { type: Schema.Types.ObjectId, ref: EquipmentModelName, required: true },
    temperature: { type: Number, required: true },
    unit: { type: String, default: '°C' },
    minAllowed: { type: Number, default: null },
    maxAllowed: { type: Number, default: null },
    inRange: { type: Boolean, default: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, maxlength: 500, default: null },
  },
  baseSchemaOptions('temperature_logs'),
);
TemperatureLogSchema.plugin(tenantPlugin);
TemperatureLogSchema.index({ labId: 1, equipmentId: 1, createdAt: -1 });

export interface NonConformanceEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  code: string;
  title: string;
  description: string;
  category: string;
  severity: NcSeverity;
  status: NcStatus;
  reportedBy: Types.ObjectId | null;
  assignedTo: Types.ObjectId | null;
  dueAt: Date | null;
  rootCause: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export const NonConformanceSchema = new Schema<NonConformanceEntity>(
  {
    code: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 3_000 },
    category: { type: String, required: true, maxlength: 80 },
    severity: { type: String, enum: NC_SEVERITIES, default: 'MINOR' },
    status: { type: String, enum: NC_STATUSES, default: 'OPEN' },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueAt: { type: Date, default: null },
    rootCause: { type: String, maxlength: 2_000, default: null },
  },
  baseSchemaOptions('non_conformances'),
);
NonConformanceSchema.plugin(tenantPlugin);
NonConformanceSchema.index({ labId: 1, code: 1 }, { unique: true });
NonConformanceSchema.index({ labId: 1, status: 1, createdAt: -1 });

export interface CapaActionEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  nonConformanceId: Types.ObjectId;
  action: string;
  owner: string | null;
  dueAt: Date | null;
  status: CapaStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
export const CapaActionSchema = new Schema<CapaActionEntity>(
  {
    nonConformanceId: { type: Schema.Types.ObjectId, ref: NonConformanceModelName, required: true },
    action: { type: String, required: true, maxlength: 1_000 },
    owner: { type: String, maxlength: 120, default: null },
    dueAt: { type: Date, default: null },
    status: { type: String, enum: CAPA_STATUSES, default: 'OPEN' },
    completedAt: { type: Date, default: null },
  },
  baseSchemaOptions('capa_actions'),
);
CapaActionSchema.plugin(tenantPlugin);
CapaActionSchema.index({ labId: 1, nonConformanceId: 1 });

export interface SendOutEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  testRequestId: Types.ObjectId;
  referenceLab: string;
  reason: string | null;
  courier: string | null;
  trackingNumber: string | null;
  status: SendOutStatus;
  sentAt: Date | null;
  receivedAt: Date | null;
  reportedAt: Date | null;
  resultSummary: string | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
export const SendOutSchema = new Schema<SendOutEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    testRequestId: { type: Schema.Types.ObjectId, ref: 'TestRequest', required: true },
    referenceLab: { type: String, required: true, trim: true, maxlength: 160 },
    reason: { type: String, maxlength: 500, default: null },
    courier: { type: String, maxlength: 120, default: null },
    trackingNumber: { type: String, maxlength: 120, default: null },
    status: { type: String, enum: SEND_OUT_STATUSES, default: 'SENT' },
    sentAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    reportedAt: { type: Date, default: null },
    resultSummary: { type: String, maxlength: 3_000, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('send_outs'),
);
SendOutSchema.plugin(tenantPlugin);
SendOutSchema.index({ labId: 1, status: 1, createdAt: -1 });
SendOutSchema.index({ labId: 1, testRequestId: 1 }, { unique: true });
