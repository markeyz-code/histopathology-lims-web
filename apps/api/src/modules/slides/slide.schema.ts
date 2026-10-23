import { Schema, Types } from 'mongoose';
import {
  PHYSICAL_STATES,
  STAIN_TYPES,
  type PhysicalState,
  type StainType,
  type Station,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const SlideModelName = 'Slide';

export interface SlideEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  specimenId: Types.ObjectId;
  blockId: Types.ObjectId;
  blockLabel: string;
  slideNumber: number;
  label: string;
  barcode: string;
  stainType: StainType;
  specialStain: string | null;
  status: PhysicalState;
  currentStation: Station | null;
  recutOfSlideId: Types.ObjectId | null;
  requestReason: string | null;
  notes: string | null;
  stainRunId: Types.ObjectId | null;
  wsiStatus: string | null;
  wsiUrl: string | null;
  wsiViewerUrl: string | null;
  wsiScanner: string | null;
  wsiMagnification: string | null;
  wsiAddedAt: Date | null;
  wsiAddedBy: Types.ObjectId | null;
  wsiMetadata: Record<string, unknown>;
  createdBy: Types.ObjectId | null;
  lastEventAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const SlideSchema = new Schema<SlideEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    specimenId: { type: Schema.Types.ObjectId, ref: 'Specimen', required: true },
    blockId: { type: Schema.Types.ObjectId, ref: 'Block', required: true },
    blockLabel: { type: String, required: true, uppercase: true, trim: true },
    slideNumber: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, uppercase: true, trim: true },
    barcode: { type: String, required: true, uppercase: true, trim: true },
    stainType: { type: String, enum: STAIN_TYPES, required: true, default: 'H_AND_E' },
    specialStain: { type: String, default: null },
    status: { type: String, enum: PHYSICAL_STATES, required: true, default: 'ACCESSIONED' },
    currentStation: { type: String, default: null },
    recutOfSlideId: { type: Schema.Types.ObjectId, ref: 'Slide', default: null },
    requestReason: { type: String, default: null },
    notes: { type: String, default: null },
    stainRunId: { type: Schema.Types.ObjectId, ref: 'StainRun', default: null },
    wsiStatus: { type: String, enum: ['LINKED', 'PROCESSING', 'FAILED'], default: null },
    wsiUrl: { type: String, default: null },
    wsiViewerUrl: { type: String, default: null },
    wsiScanner: { type: String, default: null },
    wsiMagnification: { type: String, default: null },
    wsiAddedAt: { type: Date, default: null },
    wsiAddedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    wsiMetadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    lastEventAt: { type: Date, default: null },
  },
  baseSchemaOptions('slides'),
);

SlideSchema.plugin(tenantPlugin);
SlideSchema.index({ labId: 1, barcode: 1 }, { unique: true });
SlideSchema.index({ labId: 1, caseId: 1, blockId: 1, slideNumber: 1 });
SlideSchema.index({ labId: 1, status: 1 });
SlideSchema.index({ labId: 1, stainRunId: 1 });
