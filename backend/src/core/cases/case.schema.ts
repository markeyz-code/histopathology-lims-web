import { Schema, Types } from 'mongoose';
import { CASE_STATUSES, PRIORITIES, type CaseStatus, type Priority } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const CaseModelName = 'Case';

export interface ReferringClinicianEntity {
  name: string;
  facility: string | null;
  phone: string | null;
  email: string | null;
  referrerUserId: Types.ObjectId | null;
}

export interface CaseSummaryEntity {
  specimenCount: number;
  blockCount: number;
  slideCount: number;
}

export interface CaseEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  accessionNumber: string;
  patientId: Types.ObjectId;
  priority: Priority;
  priorityRank: number;
  status: CaseStatus;
  statusChangedAt: Date;
  clinicalHistory: string;
  clinicalDiagnosis: string | null;
  subspecialty: string | null;
  referringClinician: ReferringClinicianEntity;
  assignedPathologistId: Types.ObjectId | null;
  receivedAt: Date;
  tatDeadline: Date;
  reportedAt: Date | null;
  amendedAt: Date | null;
  tatBreachedAt: Date | null;
  summary: CaseSummaryEntity;
  createdBy: Types.ObjectId | null;
  reportedBy: Types.ObjectId | null;
  lastScannedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const referringClinicianSchema = new Schema<ReferringClinicianEntity>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    facility: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    referrerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false },
);

const summarySchema = new Schema<CaseSummaryEntity>(
  {
    specimenCount: { type: Number, default: 0 },
    blockCount: { type: Number, default: 0 },
    slideCount: { type: Number, default: 0 },
  },
  { _id: false },
);

export const CaseSchema = new Schema<CaseEntity>(
  {
    accessionNumber: { type: String, required: true, trim: true, maxlength: 64 },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    priority: { type: String, enum: PRIORITIES, required: true, default: 'ROUTINE' },
    priorityRank: { type: Number, required: true, default: 2 },
    status: { type: String, enum: CASE_STATUSES, required: true, default: 'RECEIVED' },
    statusChangedAt: { type: Date, default: Date.now },
    clinicalHistory: { type: String, required: true, maxlength: 5_000 },
    clinicalDiagnosis: { type: String, default: null },
    subspecialty: { type: String, default: null },
    referringClinician: { type: referringClinicianSchema, required: true },
    assignedPathologistId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    receivedAt: { type: Date, required: true, default: Date.now },
    tatDeadline: { type: Date, required: true },
    reportedAt: { type: Date, default: null },
    amendedAt: { type: Date, default: null },
    tatBreachedAt: { type: Date, default: null },
    summary: { type: summarySchema, default: () => ({}) },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastScannedAt: { type: Date, default: null },
  },
  baseSchemaOptions('cases'),
);

CaseSchema.plugin(tenantPlugin);
CaseSchema.index({ labId: 1, accessionNumber: 1 }, { unique: true });
CaseSchema.index({ labId: 1, status: 1, priorityRank: 1, tatDeadline: 1 });
CaseSchema.index({ labId: 1, patientId: 1 });
CaseSchema.index({ labId: 1, assignedPathologistId: 1, status: 1 });
CaseSchema.index({ labId: 1, receivedAt: -1 });
CaseSchema.index({ labId: 1, 'referringClinician.email': 1 });
CaseSchema.index({ labId: 1, 'referringClinician.referrerUserId': 1 });
CaseSchema.index({ labId: 1, tatDeadline: 1, tatBreachedAt: 1 });
