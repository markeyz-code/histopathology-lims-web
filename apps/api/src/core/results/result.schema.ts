import { Schema, Types } from 'mongoose';
import {
  DISCIPLINES,
  RESULT_FLAGS,
  RESULT_STATUSES,
  type Discipline,
  type ResultStatus,
  type ResultValue,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const ResultSetModelName = 'ResultSet';
export const ResultVersionModelName = 'ResultVersion';

export interface ResultSetEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  patientId: Types.ObjectId;
  testRequestId: Types.ObjectId;
  discipline: Discipline;
  testCode: string;
  testName: string;
  status: ResultStatus;
  currentVersion: number;
  values: ResultValue[];
  comment: string | null;
  critical: boolean;
  criticalAcknowledgedAt: Date | null;
  criticalAcknowledgedBy: Types.ObjectId | null;
  criticalAckNote: string | null;
  enteredBy: Types.ObjectId | null;
  verifiedBy: Types.ObjectId | null;
  verifiedAt: Date | null;
  releasedAt: Date | null;
  autoVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const valueSchema = new Schema(
  {
    analyteKey: { type: String, required: true },
    analyteName: { type: String, default: null },
    value: { type: Schema.Types.Mixed, default: null },
    unit: { type: String, default: null },
    flag: { type: String, enum: RESULT_FLAGS, default: 'NORMAL' },
    critical: { type: Boolean, default: false },
    referenceText: { type: String, default: null },
  },
  { _id: false },
);

export const ResultSetSchema = new Schema<ResultSetEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    testRequestId: { type: Schema.Types.ObjectId, ref: 'TestRequest', required: true },
    discipline: { type: String, enum: DISCIPLINES, required: true },
    testCode: { type: String, required: true, uppercase: true },
    testName: { type: String, required: true },
    status: { type: String, enum: RESULT_STATUSES, default: 'DRAFT' },
    currentVersion: { type: Number, default: 1 },
    values: { type: [valueSchema], default: [] },
    comment: { type: String, maxlength: 2_000, default: null },
    critical: { type: Boolean, default: false },
    criticalAcknowledgedAt: { type: Date, default: null },
    criticalAcknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    criticalAckNote: { type: String, maxlength: 1_000, default: null },
    enteredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    autoVerified: { type: Boolean, default: false },
  },
  baseSchemaOptions('result_sets'),
);
ResultSetSchema.plugin(tenantPlugin);
ResultSetSchema.index({ labId: 1, testRequestId: 1 }, { unique: true });
ResultSetSchema.index({ labId: 1, patientId: 1, testCode: 1, createdAt: -1 });
ResultSetSchema.index({ labId: 1, discipline: 1, status: 1 });

export interface ResultVersionEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  resultSetId: Types.ObjectId;
  caseId: Types.ObjectId;
  version: number;
  action: string;
  values: ResultValue[];
  comment: string | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
}

export const ResultVersionSchema = new Schema<ResultVersionEntity>(
  {
    resultSetId: { type: Schema.Types.ObjectId, ref: ResultSetModelName, required: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    version: { type: Number, required: true },
    action: { type: String, required: true },
    values: { type: [valueSchema], default: [] },
    comment: { type: String, maxlength: 2_000, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('results'),
);
ResultVersionSchema.plugin(tenantPlugin);
ResultVersionSchema.index({ labId: 1, resultSetId: 1, version: -1 });
ResultVersionSchema.pre('updateOne', function (next) {
  next(new Error('Result versions are append-only.'));
});
ResultVersionSchema.pre('findOneAndUpdate', function (next) {
  next(new Error('Result versions are append-only.'));
});
ResultVersionSchema.pre('deleteOne', function (next) {
  next(new Error('Result versions are append-only.'));
});
ResultVersionSchema.pre('deleteMany', function (next) {
  next(new Error('Result versions are append-only.'));
});
