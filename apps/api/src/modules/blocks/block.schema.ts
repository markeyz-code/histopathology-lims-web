import { Schema, Types } from 'mongoose';
import { PHYSICAL_STATES, type PhysicalState, type Station } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const BlockModelName = 'Block';

export interface BlockEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  specimenId: Types.ObjectId;
  specimenSequence: number;
  blockNumber: number;
  label: string;
  barcode: string;
  grossDescription: string | null;
  status: PhysicalState;
  currentStation: Station | null;
  slideCount: number;
  lastEventAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const BlockSchema = new Schema<BlockEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    specimenId: { type: Schema.Types.ObjectId, ref: 'Specimen', required: true },
    specimenSequence: { type: Number, required: true },
    blockNumber: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, uppercase: true, trim: true },
    barcode: { type: String, required: true, uppercase: true, trim: true },
    grossDescription: { type: String, default: null },
    status: { type: String, enum: PHYSICAL_STATES, required: true, default: 'ACCESSIONED' },
    currentStation: { type: String, default: null },
    slideCount: { type: Number, default: 0 },
    lastEventAt: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  baseSchemaOptions('blocks'),
);

BlockSchema.plugin(tenantPlugin);
BlockSchema.index({ labId: 1, barcode: 1 }, { unique: true });
BlockSchema.index({ labId: 1, caseId: 1, specimenId: 1, blockNumber: 1 });
BlockSchema.index({ labId: 1, status: 1 });
