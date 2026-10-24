import { Schema, Types } from 'mongoose';
import {
  DISCIPLINES,
  QC_LEVELS,
  QC_STATUSES,
  WESTGARD_RULES,
  type Discipline,
  type QcLevel,
  type QcStatus,
  type WestgardRule,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const QcMaterialModelName = 'QcMaterial';
export const QcRunModelName = 'QcRun';

export interface QcMaterialEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  discipline: Discipline;
  name: string;
  lotNumber: string;
  level: QcLevel;
  testCode: string;
  analyteKey: string;
  targetMean: number;
  targetSd: number;
  unit: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const QcMaterialSchema = new Schema<QcMaterialEntity>(
  {
    discipline: { type: String, enum: DISCIPLINES, required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    lotNumber: { type: String, required: true, trim: true, maxlength: 80 },
    level: { type: String, enum: QC_LEVELS, required: true },
    testCode: { type: String, required: true, trim: true, uppercase: true },
    analyteKey: { type: String, required: true, trim: true },
    targetMean: { type: Number, required: true },
    targetSd: { type: Number, required: true },
    unit: { type: String, trim: true, maxlength: 30, default: null },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('qc_materials'),
);
QcMaterialSchema.plugin(tenantPlugin);
QcMaterialSchema.index({ labId: 1, discipline: 1, testCode: 1, level: 1 });

export interface QcRunEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  materialId: Types.ObjectId;
  testCode: string;
  analyteKey: string;
  mean: number;
  sd: number;
  values: number[];
  points: Array<{ value: number; z: number }>;
  status: QcStatus;
  violations: Array<{ rule: WestgardRule; message: string }>;
  comment: string | null;
  performedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const QcRunSchema = new Schema<QcRunEntity>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: QcMaterialModelName, required: true },
    testCode: { type: String, required: true, uppercase: true },
    analyteKey: { type: String, required: true },
    mean: { type: Number, required: true },
    sd: { type: Number, required: true },
    values: { type: [Number], required: true },
    points: { type: [{ value: Number, z: Number }], default: [] },
    status: { type: String, enum: QC_STATUSES, required: true },
    violations: {
      type: [{ rule: { type: String, enum: WESTGARD_RULES }, message: String }],
      default: [],
    },
    comment: { type: String, maxlength: 1_000, default: null },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('qc_runs'),
);
QcRunSchema.plugin(tenantPlugin);
QcRunSchema.index({ labId: 1, materialId: 1, createdAt: -1 });
