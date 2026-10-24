import { Schema, Types } from 'mongoose';
import {
  AST_INTERPRETATIONS,
  AST_METHODS,
  BREAKPOINT_STANDARDS,
  ORGANISM_GRAMS,
  type AstInterpretation,
  type AstMethod,
  type BreakpointStandard,
  type OrganismGram,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const OrganismModelName = 'Organism';
export const AntibioticModelName = 'Antibiotic';
export const BreakpointModelName = 'Breakpoint';
export const CultureModelName = 'Culture';
export const IsolateModelName = 'Isolate';
export const SusceptibilityModelName = 'SusceptibilityResult';

export interface OrganismEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  code: string;
  name: string;
  gram: OrganismGram;
  whonetCode: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const OrganismSchema = new Schema<OrganismEntity>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    gram: { type: String, enum: ORGANISM_GRAMS, required: true },
    whonetCode: { type: String, trim: true, maxlength: 40, default: null },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('organisms'),
);
OrganismSchema.plugin(tenantPlugin);
OrganismSchema.index({ labId: 1, code: 1 }, { unique: true });

export interface AntibioticEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  code: string;
  name: string;
  className: string;
  whonetCode: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const AntibioticSchema = new Schema<AntibioticEntity>(
  {
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    className: { type: String, required: true, trim: true, maxlength: 80 },
    whonetCode: { type: String, trim: true, maxlength: 40, default: null },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('antibiotics'),
);
AntibioticSchema.plugin(tenantPlugin);
AntibioticSchema.index({ labId: 1, code: 1 }, { unique: true });

export interface BreakpointEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  standard: BreakpointStandard;
  version: string;
  organismCode: string;
  antibioticCode: string;
  method: AstMethod;
  susceptibleThreshold: number;
  resistantThreshold: number;
  unit: string | null;
  firstLine: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export const BreakpointSchema = new Schema<BreakpointEntity>(
  {
    standard: { type: String, enum: BREAKPOINT_STANDARDS, required: true },
    version: { type: String, required: true, trim: true, maxlength: 40 },
    organismCode: { type: String, required: true, trim: true, uppercase: true },
    antibioticCode: { type: String, required: true, trim: true, uppercase: true },
    method: { type: String, enum: AST_METHODS, required: true },
    susceptibleThreshold: { type: Number, required: true },
    resistantThreshold: { type: Number, required: true },
    unit: { type: String, trim: true, maxlength: 30, default: null },
    firstLine: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('breakpoint_tables'),
);
BreakpointSchema.plugin(tenantPlugin);
BreakpointSchema.index(
  { labId: 1, organismCode: 1, antibioticCode: 1, method: 1 },
  { unique: true },
);

export interface CultureEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  patientId: Types.ObjectId;
  testRequestId: Types.ObjectId;
  status: string;
  specimenType: string;
  plateType: string | null;
  media: string | null;
  incubation: string | null;
  organismCode: string | null;
  colonyCount: string | null;
  notes: string | null;
  resistanceFlags: string[];
  reportedAt: Date | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
export const CultureSchema = new Schema<CultureEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    testRequestId: { type: Schema.Types.ObjectId, ref: 'TestRequest', required: true },
    status: { type: String, default: 'RECEIVED' },
    specimenType: { type: String, required: true, trim: true, maxlength: 80 },
    plateType: { type: String, trim: true, maxlength: 80, default: null },
    media: { type: String, trim: true, maxlength: 80, default: null },
    incubation: { type: String, trim: true, maxlength: 120, default: null },
    organismCode: { type: String, trim: true, uppercase: true, default: null },
    colonyCount: { type: String, trim: true, maxlength: 80, default: null },
    notes: { type: String, maxlength: 2_000, default: null },
    resistanceFlags: { type: [String], default: [] },
    reportedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('cultures'),
);
CultureSchema.plugin(tenantPlugin);
CultureSchema.index({ labId: 1, testRequestId: 1 }, { unique: true });
CultureSchema.index({ labId: 1, status: 1, createdAt: -1 });

export interface IsolateEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  cultureId: Types.ObjectId;
  organismCode: string;
  organismName: string;
  gram: OrganismGram | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export const IsolateSchema = new Schema<IsolateEntity>(
  {
    cultureId: { type: Schema.Types.ObjectId, ref: CultureModelName, required: true },
    organismCode: { type: String, required: true, trim: true, uppercase: true },
    organismName: { type: String, required: true, trim: true },
    gram: { type: String, enum: ORGANISM_GRAMS, default: null },
    notes: { type: String, maxlength: 1_000, default: null },
  },
  baseSchemaOptions('isolates'),
);
IsolateSchema.plugin(tenantPlugin);
IsolateSchema.index({ labId: 1, cultureId: 1 });

export interface SusceptibilityEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  cultureId: Types.ObjectId;
  isolateId: Types.ObjectId;
  antibioticCode: string;
  antibioticName: string;
  method: AstMethod;
  value: number | null;
  interpretation: AstInterpretation;
  breakpointId: Types.ObjectId | null;
  standard: BreakpointStandard | null;
  unit: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export const SusceptibilitySchema = new Schema<SusceptibilityEntity>(
  {
    cultureId: { type: Schema.Types.ObjectId, ref: CultureModelName, required: true },
    isolateId: { type: Schema.Types.ObjectId, ref: IsolateModelName, required: true },
    antibioticCode: { type: String, required: true, uppercase: true },
    antibioticName: { type: String, required: true },
    method: { type: String, enum: AST_METHODS, required: true },
    value: { type: Number, default: null },
    interpretation: { type: String, enum: AST_INTERPRETATIONS, required: true },
    breakpointId: { type: Schema.Types.ObjectId, ref: BreakpointModelName, default: null },
    standard: { type: String, enum: BREAKPOINT_STANDARDS, default: null },
    unit: { type: String, default: null },
    notes: { type: String, maxlength: 500, default: null },
  },
  baseSchemaOptions('susceptibility_results'),
);
SusceptibilitySchema.plugin(tenantPlugin);
SusceptibilitySchema.index({ labId: 1, cultureId: 1, antibioticCode: 1 });
