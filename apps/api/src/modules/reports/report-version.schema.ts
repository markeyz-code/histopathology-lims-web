import { Schema, Types } from 'mongoose';
import type { ReportData } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';
import { makeAppendOnly } from '../../common/database/append-only';

export const ReportVersionModelName = 'ReportVersion';

export interface ReportVersionEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  reportId: Types.ObjectId;
  caseId: Types.ObjectId;
  version: number;
  action: 'SIGN_OUT' | 'AMEND';
  data: ReportData;
  narrative: string;
  reason: string | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ReportVersionSchema = new Schema<ReportVersionEntity>(
  {
    reportId: { type: Schema.Types.ObjectId, ref: 'Report', required: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    version: { type: Number, required: true },
    action: { type: String, enum: ['SIGN_OUT', 'AMEND'], required: true },
    data: { type: Schema.Types.Mixed, required: true },
    narrative: { type: String, required: true },
    reason: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('report_versions'),
);

ReportVersionSchema.plugin(tenantPlugin);
makeAppendOnly(ReportVersionSchema, 'Report version');
ReportVersionSchema.index({ labId: 1, reportId: 1, version: 1 }, { unique: true });
ReportVersionSchema.index({ labId: 1, caseId: 1 });
