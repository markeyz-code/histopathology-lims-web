import { Schema, Types } from 'mongoose';
import { CONSIGNMENT_STATUSES, type ConsignmentStatus } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const CollectionCentreModelName = 'CollectionCentre';
export const ConsignmentModelName = 'Consignment';

export interface CollectionCentreEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  homeCollection: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const CollectionCentreSchema = new Schema<CollectionCentreEntity>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    address: { type: String, trim: true, maxlength: 300, default: null },
    phone: { type: String, trim: true, maxlength: 40, default: null },
    homeCollection: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('collection_centres'),
);
CollectionCentreSchema.plugin(tenantPlugin);
CollectionCentreSchema.index({ labId: 1, code: 1 }, { unique: true });

export interface ConsignmentEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  code: string;
  centreId: Types.ObjectId;
  riderName: string | null;
  riderPhone: string | null;
  status: ConsignmentStatus;
  testRequestIds: Types.ObjectId[];
  dispatchedAt: Date | null;
  receivedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  notes: string | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ConsignmentSchema = new Schema<ConsignmentEntity>(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    centreId: { type: Schema.Types.ObjectId, ref: CollectionCentreModelName, required: true },
    riderName: { type: String, trim: true, maxlength: 120, default: null },
    riderPhone: { type: String, trim: true, maxlength: 40, default: null },
    status: { type: String, enum: CONSIGNMENT_STATUSES, default: 'CREATED' },
    testRequestIds: { type: [Schema.Types.ObjectId], default: [] },
    dispatchedAt: { type: Date, default: null },
    receivedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, maxlength: 500, default: null },
    notes: { type: String, maxlength: 500, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('consignments'),
);
ConsignmentSchema.plugin(tenantPlugin);
ConsignmentSchema.index({ labId: 1, code: 1 }, { unique: true });
ConsignmentSchema.index({ labId: 1, status: 1, createdAt: -1 });
