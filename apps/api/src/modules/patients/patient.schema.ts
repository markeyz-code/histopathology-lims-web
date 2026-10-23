import { Schema, Types } from 'mongoose';
import { SEXES, type Sex } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const PatientModelName = 'Patient';

export interface NextOfKinEntity {
  name: string | null;
  phone: string | null;
  relationship: string | null;
}

export interface PatientEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  mrn: string;
  firstName: string;
  lastName: string;
  sex: Sex;
  dateOfBirth: Date | null;
  age: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  nationalId: string | null;
  nextOfKin: NextOfKinEntity | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const nextOfKinSchema = new Schema<NextOfKinEntity>(
  {
    name: { type: String, default: null },
    phone: { type: String, default: null },
    relationship: { type: String, default: null },
  },
  { _id: false },
);

export const PatientSchema = new Schema<PatientEntity>(
  {
    mrn: { type: String, required: true, uppercase: true, trim: true, maxlength: 40 },
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName: { type: String, required: true, trim: true, maxlength: 100 },
    sex: { type: String, enum: SEXES, required: true },
    dateOfBirth: { type: Date, default: null },
    age: { type: Number, default: null, min: 0, max: 130 },
    phone: { type: String, default: null },
    email: { type: String, default: null, lowercase: true },
    address: { type: String, default: null },
    nationalId: { type: String, default: null },
    nextOfKin: { type: nextOfKinSchema, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('patients'),
);

PatientSchema.plugin(tenantPlugin);
PatientSchema.index({ labId: 1, mrn: 1 }, { unique: true });
PatientSchema.index({ labId: 1, lastName: 1, firstName: 1 });
PatientSchema.index({ labId: 1, phone: 1 });
