import { Schema, Types } from 'mongoose';
import {
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  type PaymentProvider,
  type PaymentStatus,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const PaymentModelName = 'Payment';

export interface PaymentEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  reference: string;
  providerReference: string | null;
  checkoutUrl: string | null;
  paidAt: Date | null;
  metadata: Record<string, unknown>;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const PaymentSchema = new Schema<PaymentEntity>(
  {
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: 'PENDING' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, maxlength: 3 },
    reference: { type: String, required: true, trim: true, maxlength: 100 },
    providerReference: { type: String, default: null },
    checkoutUrl: { type: String, default: null },
    paidAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('payments'),
);

PaymentSchema.plugin(tenantPlugin);
PaymentSchema.index({ labId: 1, reference: 1 }, { unique: true });
PaymentSchema.index({ labId: 1, invoiceId: 1, createdAt: -1 });
PaymentSchema.index({ labId: 1, status: 1, createdAt: -1 });
