import { Schema, Types } from 'mongoose';
import { ROLES, type Role } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const NotificationModelName = 'Notification';

export interface NotificationEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  channel: string;
  status: string;
  type: string;
  title: string;
  body: string;
  userId: Types.ObjectId | null;
  role: Role | null;
  entityType: string | null;
  entityId: string | null;
  caseId: string | null;
  recipient: string | null;
  provider: string | null;
  providerMessageId: string | null;
  attempts: number;
  lastError: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const NotificationSchema = new Schema<NotificationEntity>(
  {
    channel: {
      type: String,
      enum: ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'],
      required: true,
      default: 'IN_APP',
    },
    status: {
      type: String,
      enum: ['QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'],
      required: true,
      default: 'SENT',
    },
    type: { type: String, required: true, maxlength: 60 },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 2_000 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    role: { type: String, enum: ROLES, default: null },
    entityType: { type: String, default: null },
    entityId: { type: String, default: null },
    caseId: { type: String, default: null },
    recipient: { type: String, default: null },
    provider: { type: String, default: null },
    providerMessageId: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  baseSchemaOptions('notifications'),
);

NotificationSchema.plugin(tenantPlugin);
NotificationSchema.index({ labId: 1, createdAt: -1 });
NotificationSchema.index({ labId: 1, userId: 1, readAt: 1 });
NotificationSchema.index({ labId: 1, channel: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ labId: 1, recipient: 1, createdAt: -1 });
