import { Schema, Types } from 'mongoose';
import { INVOICE_STATUSES, PAYER_TYPES, type InvoiceStatus, type PayerType } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const InvoiceModelName = 'Invoice';

export interface InvoiceItemEntity {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
}

export interface InvoiceEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  number: string;
  caseId: Types.ObjectId;
  patientId: Types.ObjectId;
  payerType: PayerType;
  hmoName: string | null;
  hmoCode: string | null;
  authorizationNumber: string | null;
  status: InvoiceStatus;
  currency: string;
  items: InvoiceItemEntity[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  dueAt: Date | null;
  issuedAt: Date | null;
  paidAt: Date | null;
  notes: string | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<InvoiceItemEntity>(
  {
    description: { type: String, required: true, maxlength: 200 },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, default: 'PROFESSIONAL' },
  },
  { _id: false },
);

export const InvoiceSchema = new Schema<InvoiceEntity>(
  {
    number: { type: String, required: true, trim: true, maxlength: 40 },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    payerType: { type: String, enum: PAYER_TYPES, required: true, default: 'SELF' },
    hmoName: { type: String, default: null, maxlength: 160 },
    hmoCode: { type: String, default: null, maxlength: 80 },
    authorizationNumber: { type: String, default: null, maxlength: 80 },
    status: { type: String, enum: INVOICE_STATUSES, required: true, default: 'ISSUED' },
    currency: { type: String, required: true, uppercase: true, maxlength: 3, default: 'NGN' },
    items: { type: [itemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    dueAt: { type: Date, default: null },
    issuedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('invoices'),
);

InvoiceSchema.plugin(tenantPlugin);
InvoiceSchema.index({ labId: 1, number: 1 }, { unique: true });
InvoiceSchema.index({ labId: 1, caseId: 1, createdAt: -1 });
InvoiceSchema.index({ labId: 1, status: 1, dueAt: 1 });
InvoiceSchema.index({ labId: 1, payerType: 1, issuedAt: -1 });
