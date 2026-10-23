import { Schema, Types } from 'mongoose';
import {
  STAIN_QC_RESULTS,
  STAIN_RUN_STATUSES,
  STAIN_TYPES,
  type StainQcResult,
  type StainRunStatus,
  type StainType,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export interface StainRunLotEntity {
  lotId: Types.ObjectId;
  lotNumber: string;
  name: string;
  quantityUsed: number;
}

export interface StainRunEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  slideId: Types.ObjectId | null;
  blockId: Types.ObjectId | null;
  stainType: StainType;
  stainName: string;
  status: StainRunStatus;
  qcResult: StainQcResult;
  lots: StainRunLotEntity[];
  equipment: string | null;
  operatorId: Types.ObjectId | null;
  startedAt: Date | null;
  completedAt: Date | null;
  notes: string | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const StainRunModelName = 'StainRun';

export const StainRunSchema = new Schema<StainRunEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    slideId: { type: Schema.Types.ObjectId, ref: 'Slide', default: null },
    blockId: { type: Schema.Types.ObjectId, ref: 'Block', default: null },
    stainType: { type: String, enum: STAIN_TYPES, required: true },
    stainName: { type: String, required: true, maxlength: 160 },
    status: { type: String, enum: STAIN_RUN_STATUSES, default: 'RUNNING' },
    qcResult: { type: String, enum: STAIN_QC_RESULTS, default: 'PENDING' },
    lots: {
      type: [
        new Schema<StainRunLotEntity>(
          {
            lotId: { type: Schema.Types.ObjectId, ref: 'ReagentLot', required: true },
            lotNumber: { type: String, required: true },
            name: { type: String, required: true },
            quantityUsed: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    equipment: { type: String, default: null },
    operatorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('stain_runs'),
);

StainRunSchema.plugin(tenantPlugin);
StainRunSchema.index({ labId: 1, caseId: 1, createdAt: -1 });
StainRunSchema.index({ labId: 1, slideId: 1 });
StainRunSchema.index({ labId: 1, status: 1, startedAt: -1 });
