import { Schema, Types } from 'mongoose';
import {
  ORGANIZATION_STATUSES,
  ORGANIZATION_TYPES,
  SUBSCRIPTION_PLANS,
  type OrganizationStatus,
  type OrganizationType,
  type SubscriptionPlan,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';

export const OrganizationModelName = 'Organization';

export interface OrganizationEntity {
  _id: Types.ObjectId;
  code: string;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  plan: SubscriptionPlan;
  seats: number;
  country: string;
  state: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  trialEndsAt: Date | null;
  notes: string | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const OrganizationSchema = new Schema<OrganizationEntity>(
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
    type: { type: String, enum: ORGANIZATION_TYPES, required: true },
    status: { type: String, enum: ORGANIZATION_STATUSES, default: 'ONBOARDING' },
    plan: { type: String, enum: SUBSCRIPTION_PLANS, default: 'TRIAL' },
    seats: { type: Number, default: 10, min: 1 },
    country: { type: String, default: 'Nigeria', trim: true, maxlength: 80 },
    state: { type: String, trim: true, maxlength: 80, default: null },
    city: { type: String, trim: true, maxlength: 80, default: null },
    address: { type: String, trim: true, maxlength: 300, default: null },
    phone: { type: String, trim: true, maxlength: 40, default: null },
    email: { type: String, lowercase: true, trim: true, maxlength: 160, default: null },
    website: { type: String, trim: true, maxlength: 160, default: null },
    trialEndsAt: { type: Date, default: null },
    notes: { type: String, maxlength: 1_000, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('organizations'),
);
OrganizationSchema.index({ status: 1, createdAt: -1 });
OrganizationSchema.index({ plan: 1 });
