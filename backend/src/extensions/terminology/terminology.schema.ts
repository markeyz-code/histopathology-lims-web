import { Schema, Types } from 'mongoose';
import { CODING_SYSTEMS, type CodingSystem } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const TerminologyModelName = 'TerminologyCode';

export interface TerminologyEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  system: CodingSystem;
  code: string;
  display: string;
  category: string | null;
  synonyms: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const TerminologySchema = new Schema<TerminologyEntity>(
  {
    system: { type: String, enum: CODING_SYSTEMS, required: true },
    code: { type: String, required: true, trim: true, maxlength: 40 },
    display: { type: String, required: true, trim: true, maxlength: 240 },
    category: { type: String, default: null, maxlength: 80 },
    synonyms: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  baseSchemaOptions('terminology_codes'),
);

TerminologySchema.plugin(tenantPlugin);
TerminologySchema.index({ labId: 1, system: 1, code: 1 }, { unique: true });
TerminologySchema.index({ labId: 1, system: 1, active: 1, display: 1 });
