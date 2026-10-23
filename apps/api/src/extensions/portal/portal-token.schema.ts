import { Schema, Types } from 'mongoose';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const PortalTokenModelName = 'PortalToken';

export interface PortalTokenEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  userId: Types.ObjectId;
  email: string;
  tokenHash: string;
  codeHash: string;
  type: 'MAGIC_LINK' | 'OTP';
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const PortalTokenSchema = new Schema<PortalTokenEntity>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
    tokenHash: { type: String, required: true, select: false },
    codeHash: { type: String, required: true, select: false },
    type: { type: String, enum: ['MAGIC_LINK', 'OTP'], required: true, default: 'OTP' },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  baseSchemaOptions('portal_tokens'),
);

PortalTokenSchema.plugin(tenantPlugin);
PortalTokenSchema.index({ labId: 1, userId: 1, consumedAt: 1, createdAt: -1 });
PortalTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
