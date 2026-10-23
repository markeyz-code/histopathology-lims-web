import { Schema, Types } from 'mongoose';
import { baseSchemaOptions } from '../database/schema-options';
import { tenantPlugin } from '../database/tenant.plugin';

export const IdempotencyModelName = 'IdempotencyKey';

export interface IdempotencyEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  key: string;
  scope: string;
  requestHash: string;
  status: 'PENDING' | 'COMPLETED';
  response: unknown;
  statusCode: number | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const IdempotencySchema = new Schema<IdempotencyEntity>(
  {
    key: { type: String, required: true, maxlength: 120 },
    scope: { type: String, required: true, maxlength: 80 },
    requestHash: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'COMPLETED'], default: 'PENDING' },
    response: { type: Schema.Types.Mixed, default: null },
    statusCode: { type: Number, default: null },
    expiresAt: { type: Date, required: true },
  },
  baseSchemaOptions('idempotency_keys'),
);

IdempotencySchema.plugin(tenantPlugin);
IdempotencySchema.index({ labId: 1, key: 1, scope: 1 }, { unique: true });
IdempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
