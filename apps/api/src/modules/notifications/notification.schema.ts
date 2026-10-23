import { Schema, Types } from 'mongoose';
import { ROLES, type Role } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const NotificationModelName = 'Notification';

export interface NotificationEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  type: string;
  title: string;
  body: string;
  userId: Types.ObjectId | null;
  role: Role | null;
  entityType: string | null;
  entityId: string | null;
  caseId: string | null;
  readAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = new Schema<NotificationEntity>(
  {
    type: { type: String, required: true, maxlength: 60 },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 2_000 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    role: { type: String, enum: ROLES, default: null },
    entityType: { type: String, default: null },
    entityId: { type: String, default: null },
    caseId: { type: String, default: null },
    readAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  baseSchemaOptions('notifications'),
);

NotificationSchema.plugin(tenantPlugin);
NotificationSchema.index({ labId: 1, createdAt: -1 });
NotificationSchema.index({ labId: 1, userId: 1, readAt: 1 });
