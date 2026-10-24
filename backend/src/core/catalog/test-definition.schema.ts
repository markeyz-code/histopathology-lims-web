import { Schema, Types } from 'mongoose';
import {
  DISCIPLINES,
  TEST_REQUEST_STATUSES,
  type AnalyteDefinition,
  type Discipline,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const TestDefinitionModelName = 'TestDefinition';

export interface TestDefinitionEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  discipline: Discipline;
  code: string;
  name: string;
  specimenType: string;
  method: string | null;
  analytes: AnalyteDefinition[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const TestDefinitionSchema = new Schema<TestDefinitionEntity>(
  {
    discipline: { type: String, enum: DISCIPLINES, required: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    specimenType: { type: String, required: true, trim: true, maxlength: 80 },
    method: { type: String, trim: true, maxlength: 120, default: null },
    analytes: { type: Schema.Types.Mixed, required: true },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('test_definitions'),
);

TestDefinitionSchema.plugin(tenantPlugin);
TestDefinitionSchema.index({ labId: 1, discipline: 1, code: 1 }, { unique: true });

export const PanelModelName = 'Panel';

export interface PanelEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  discipline: Discipline;
  code: string;
  name: string;
  testCodes: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const PanelSchema = new Schema<PanelEntity>(
  {
    discipline: { type: String, enum: DISCIPLINES, required: true },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    testCodes: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('panels'),
);

PanelSchema.plugin(tenantPlugin);
PanelSchema.index({ labId: 1, discipline: 1, code: 1 }, { unique: true });

void TEST_REQUEST_STATUSES;
