import { Schema, Types } from 'mongoose';
import { LEAD_STATUSES, LEAD_TYPES, type LeadStatus, type LeadType } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';

export const LeadModelName = 'Lead';

export interface LeadEntity {
  _id: Types.ObjectId;
  type: LeadType;
  organizationName: string;
  contactName: string;
  email: string;
  phone: string | null;
  role: string | null;
  departments: string[];
  monthlyVolume: string | null;
  message: string | null;
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const LeadSchema = new Schema<LeadEntity>(
  {
    type: { type: String, enum: LEAD_TYPES, default: 'DEMO' },
    organizationName: { type: String, required: true, trim: true, maxlength: 200 },
    contactName: { type: String, required: true, trim: true, maxlength: 150 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
    phone: { type: String, trim: true, maxlength: 40, default: null },
    role: { type: String, trim: true, maxlength: 120, default: null },
    departments: { type: [String], default: [] },
    monthlyVolume: { type: String, trim: true, maxlength: 80, default: null },
    message: { type: String, maxlength: 2_000, default: null },
    status: { type: String, enum: LEAD_STATUSES, default: 'NEW' },
  },
  baseSchemaOptions('leads'),
);
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ type: 1, createdAt: -1 });
