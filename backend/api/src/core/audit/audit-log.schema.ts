import { Schema, Types } from 'mongoose';
import { AUDIT_ACTIONS, ROLES, type AuditAction, type Role } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';
import { makeAppendOnly } from '../../common/database/append-only';

export const AuditLogModelName = 'AuditLog';

export interface AuditLogEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  caseId: string | null;
  userId: Types.ObjectId | null;
  userName: string;
  userRole: Role | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const AuditLogSchema = new Schema<AuditLogEntity>(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entityType: { type: String, required: true, maxlength: 60 },
    entityId: { type: String, default: null },
    caseId: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    userName: { type: String, required: true },
    userRole: { type: String, enum: ROLES, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    requestId: { type: String, default: null },
  },
  baseSchemaOptions('audit_logs'),
);

AuditLogSchema.plugin(tenantPlugin);
makeAppendOnly(AuditLogSchema, 'Audit log');
AuditLogSchema.index({ labId: 1, createdAt: -1 });
AuditLogSchema.index({ labId: 1, entityType: 1, entityId: 1 });
AuditLogSchema.index({ labId: 1, userId: 1, createdAt: -1 });
AuditLogSchema.index({ labId: 1, caseId: 1 });
