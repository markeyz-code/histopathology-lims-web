import { Schema, Types } from 'mongoose';
import { REPORT_STATUSES, type ReportData, type ReportStatus } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const ReportModelName = 'Report';

export interface ReportProtocolSnapshotEntity {
  protocolId: string;
  key: string;
  title: string;
  cancerType: string;
  subspecialty: string;
  version: number;
  content: unknown;
}

export interface ReportEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  protocolId: Types.ObjectId;
  protocolSnapshot: ReportProtocolSnapshotEntity;
  protocolVersion: number;
  status: ReportStatus;
  data: ReportData;
  narrative: string;
  version: number;
  requiredComplete: boolean;
  missingRequired: string[];
  signedOutBy: Types.ObjectId | null;
  signedOutAt: Date | null;
  amendedAt: Date | null;
  amendmentReason: string | null;
  verificationCode: string | null;
  coding: {
    snomedCode: string | null;
    snomedDisplay: string | null;
    icdo3MorphologyCode: string | null;
    icdo3MorphologyDisplay: string | null;
    icdo3TopographyCode: string | null;
    icdo3TopographyDisplay: string | null;
  };
  releasedAt: Date | null;
  releasedBy: Types.ObjectId | null;
  releaseNote: string | null;
  secondOpinionStatus: string | null;
  pdfPath: string | null;
  pdfGeneratedAt: Date | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ReportSchema = new Schema<ReportEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    protocolId: { type: Schema.Types.ObjectId, ref: 'Protocol', required: true },
    protocolSnapshot: { type: Schema.Types.Mixed, required: true },
    protocolVersion: { type: Number, required: true },
    status: { type: String, enum: REPORT_STATUSES, required: true, default: 'DRAFT' },
    data: { type: Schema.Types.Mixed, default: {} },
    narrative: { type: String, default: '' },
    version: { type: Number, required: true, default: 0 },
    requiredComplete: { type: Boolean, default: false },
    missingRequired: { type: [String], default: [] },
    signedOutBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    signedOutAt: { type: Date, default: null },
    amendedAt: { type: Date, default: null },
    amendmentReason: { type: String, default: null },
    verificationCode: { type: String, default: null },
    coding: {
      snomedCode: { type: String, default: null },
      snomedDisplay: { type: String, default: null },
      icdo3MorphologyCode: { type: String, default: null },
      icdo3MorphologyDisplay: { type: String, default: null },
      icdo3TopographyCode: { type: String, default: null },
      icdo3TopographyDisplay: { type: String, default: null },
    },
    releasedAt: { type: Date, default: null },
    releasedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    releaseNote: { type: String, default: null },
    secondOpinionStatus: { type: String, default: null },
    pdfPath: { type: String, default: null },
    pdfGeneratedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('reports'),
);

ReportSchema.plugin(tenantPlugin);
ReportSchema.index({ labId: 1, caseId: 1 }, { unique: true });
ReportSchema.index(
  { verificationCode: 1 },
  { unique: true, partialFilterExpression: { verificationCode: { $type: 'string' } } },
);
ReportSchema.index({ labId: 1, status: 1, signedOutAt: -1 });
ReportSchema.index({ labId: 1, releasedAt: -1 });
