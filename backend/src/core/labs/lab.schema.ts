import { Schema, Types } from 'mongoose';
import {
  DEFAULT_ACCESSION_FORMAT,
  DEFAULT_ACCESSION_PREFIX,
  DEFAULT_TAT_HOURS,
  DEFAULT_TAT_WARNING_PERCENT,
  type Discipline,
  type Priority,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';

export const LabModelName = 'Lab';

export interface LabLetterhead {
  phone: string | null;
  email: string | null;
  website: string | null;
  pathologistName: string | null;
  pathologistTitle: string | null;
  qualifications: string | null;
  signatureText: string | null;
  footerNote: string | null;
}

export interface LabEntity {
  _id: Types.ObjectId;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  accessionPrefix: string;
  accessionFormat: string;
  accessionCounters: Map<string, number>;
  tatHours: Record<Priority, number>;
  tatWarningPercent: number;
  timezone: string;
  qaSamplingPercent: number;
  currency: string;
  enabledDisciplines: Discipline[];
  accessionPrefixes: Partial<Record<Discipline, string>>;
  organizationId: Types.ObjectId | null;
  onboardingCompletedAt: Date | null;
  letterhead: LabLetterhead;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const letterheadSchema = new Schema<LabLetterhead>(
  {
    phone: { type: String, default: null },
    email: { type: String, default: null },
    website: { type: String, default: null },
    pathologistName: { type: String, default: null },
    pathologistTitle: { type: String, default: null },
    qualifications: { type: String, default: null },
    signatureText: { type: String, default: null },
    footerNote: { type: String, default: null },
  },
  { _id: false },
);

export const LabSchema = new Schema<LabEntity>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 32,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    address: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    accessionPrefix: { type: String, default: DEFAULT_ACCESSION_PREFIX, uppercase: true },
    accessionFormat: { type: String, default: DEFAULT_ACCESSION_FORMAT },
    accessionCounters: { type: Map, of: Number, default: {} },
    tatHours: {
      FROZEN: { type: Number, default: DEFAULT_TAT_HOURS.FROZEN },
      URGENT: { type: Number, default: DEFAULT_TAT_HOURS.URGENT },
      ROUTINE: { type: Number, default: DEFAULT_TAT_HOURS.ROUTINE },
    },
    tatWarningPercent: { type: Number, default: DEFAULT_TAT_WARNING_PERCENT, min: 50, max: 95 },
    timezone: { type: String, default: 'Africa/Lagos' },
    qaSamplingPercent: { type: Number, default: 10, min: 0, max: 100 },
    currency: { type: String, default: 'NGN', uppercase: true, maxlength: 3 },
    enabledDisciplines: {
      type: [
        {
          type: String,
          enum: ['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY', 'MICROBIOLOGY'],
        },
      ],
      default: ['HISTOPATHOLOGY'],
      validate: {
        validator: (value: string[]) => value.length > 0,
        message: 'At least one discipline must be enabled.',
      },
    },
    accessionPrefixes: { type: Schema.Types.Mixed, default: {} },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    onboardingCompletedAt: { type: Date, default: null },
    letterhead: { type: letterheadSchema, default: () => ({}) },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('labs'),
);
