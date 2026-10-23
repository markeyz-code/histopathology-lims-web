import { Schema, Types } from 'mongoose';
import {
  LATERALITIES,
  PHYSICAL_STATES,
  type Laterality,
  type PhysicalState,
  type Station,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const SpecimenModelName = 'Specimen';

export interface SpecimenEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  sequence: number;
  label: string;
  barcode: string;
  specimenType: string;
  site: string;
  laterality: Laterality | null;
  description: string | null;
  collectedAt: Date | null;
  receivedAt: Date;
  grossDescription: string | null;
  status: PhysicalState;
  currentStation: Station | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const SpecimenSchema = new Schema<SpecimenEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    sequence: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, uppercase: true, trim: true },
    barcode: { type: String, required: true, uppercase: true, trim: true },
    specimenType: { type: String, required: true, trim: true, maxlength: 120 },
    site: { type: String, required: true, trim: true, maxlength: 200 },
    laterality: { type: String, enum: LATERALITIES, default: null },
    description: { type: String, default: null },
    collectedAt: { type: Date, default: null },
    receivedAt: { type: Date, required: true, default: Date.now },
    grossDescription: { type: String, default: null },
    status: { type: String, enum: PHYSICAL_STATES, required: true, default: 'ACCESSIONED' },
    currentStation: { type: String, default: null },
    rejectionReason: { type: String, default: null },
  },
  baseSchemaOptions('specimens'),
);

SpecimenSchema.plugin(tenantPlugin);
SpecimenSchema.index({ labId: 1, barcode: 1 }, { unique: true });
SpecimenSchema.index({ labId: 1, caseId: 1, sequence: 1 });
