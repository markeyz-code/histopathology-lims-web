import { Schema, Types } from 'mongoose';
import {
  LOT_VALIDATION_STATUSES,
  REAGENT_CATEGORIES,
  REAGENT_LOT_STATUSES,
  type LotValidationStatus,
  type ReagentCategory,
  type ReagentLotStatus,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const ReagentLotModelName = 'ReagentLot';

export interface ReagentLotEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  name: string;
  category: ReagentCategory;
  vendor: string;
  catalogNumber: string | null;
  lotNumber: string;
  storageLocation: string | null;
  quantity: number;
  initialQuantity: number;
  unit: string;
  receivedAt: Date;
  openedAt: Date | null;
  expiresAt: Date;
  status: ReagentLotStatus;
  validationStatus: LotValidationStatus;
  validatedAt: Date | null;
  validatedBy: Types.ObjectId | null;
  validationNote: string | null;
  reorderLevel: number;
  expiryAlertedAt: Date | null;
  notes: string | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ReagentLotSchema = new Schema<ReagentLotEntity>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    category: { type: String, enum: REAGENT_CATEGORIES, required: true },
    vendor: { type: String, required: true, trim: true, maxlength: 160 },
    catalogNumber: { type: String, default: null, maxlength: 80 },
    lotNumber: { type: String, required: true, trim: true, maxlength: 80 },
    storageLocation: { type: String, default: null, maxlength: 120 },
    quantity: { type: Number, required: true, min: 0 },
    initialQuantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, maxlength: 32 },
    receivedAt: { type: Date, required: true },
    openedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: REAGENT_LOT_STATUSES, default: 'QUARANTINED' },
    validationStatus: { type: String, enum: LOT_VALIDATION_STATUSES, default: 'PENDING' },
    validatedAt: { type: Date, default: null },
    validatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    validationNote: { type: String, default: null },
    reorderLevel: { type: Number, default: 0, min: 0 },
    expiryAlertedAt: { type: Date, default: null },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('reagent_lots'),
);

ReagentLotSchema.plugin(tenantPlugin);
ReagentLotSchema.index({ labId: 1, lotNumber: 1, vendor: 1 }, { unique: true });
ReagentLotSchema.index({ labId: 1, status: 1, expiresAt: 1 });
ReagentLotSchema.index({ labId: 1, category: 1, name: 1 });
