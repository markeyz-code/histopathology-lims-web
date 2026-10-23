import { Schema, Types } from 'mongoose';
import {
  QA_DISCREPANCY_CODES,
  QA_REVIEW_STATUSES,
  QA_REVIEW_TYPES,
  QA_SEVERITIES,
  type QaDiscrepancyCode,
  type QaReviewStatus,
  type QaReviewType,
  type QaSeverity,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const QaReviewModelName = 'QaReview';

export interface QaReviewEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  reportId: Types.ObjectId | null;
  type: QaReviewType;
  status: QaReviewStatus;
  reason: string | null;
  requestedBy: Types.ObjectId | null;
  reviewerId: Types.ObjectId | null;
  dueAt: Date | null;
  originalDiagnosis: string | null;
  reviewDiagnosis: string | null;
  discrepancyCode: QaDiscrepancyCode | null;
  severity: QaSeverity | null;
  findings: string | null;
  actionPlan: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const QaReviewSchema = new Schema<QaReviewEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    reportId: { type: Schema.Types.ObjectId, ref: 'Report', default: null },
    type: { type: String, enum: QA_REVIEW_TYPES, required: true },
    status: { type: String, enum: QA_REVIEW_STATUSES, required: true, default: 'PENDING' },
    reason: { type: String, default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueAt: { type: Date, default: null },
    originalDiagnosis: { type: String, default: null },
    reviewDiagnosis: { type: String, default: null },
    discrepancyCode: { type: String, enum: QA_DISCREPANCY_CODES, default: null },
    severity: { type: String, enum: QA_SEVERITIES, default: null },
    findings: { type: String, default: null },
    actionPlan: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  baseSchemaOptions('qa_reviews'),
);

QaReviewSchema.plugin(tenantPlugin);
QaReviewSchema.index({ labId: 1, status: 1, dueAt: 1 });
QaReviewSchema.index({ labId: 1, reviewerId: 1, status: 1 });
QaReviewSchema.index({ labId: 1, caseId: 1, createdAt: -1 });
QaReviewSchema.index({ labId: 1, reportId: 1, status: 1 });
