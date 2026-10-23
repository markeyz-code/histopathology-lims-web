import { Schema, Types } from 'mongoose';
import type { ProtocolContent } from '@lims/shared';
import { baseSchemaOptions } from '../../../common/database/schema-options';
import { tenantPlugin } from '../../../common/database/tenant.plugin';

export const ProtocolModelName = 'Protocol';

export interface ProtocolEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  key: string;
  title: string;
  cancerType: string;
  subspecialty: string;
  version: number;
  active: boolean;
  content: ProtocolContent;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ProtocolSchema = new Schema<ProtocolEntity>(
  {
    key: { type: String, required: true, lowercase: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    cancerType: { type: String, required: true, trim: true, maxlength: 120 },
    subspecialty: { type: String, required: true, trim: true, maxlength: 80 },
    version: { type: Number, required: true, default: 1 },
    active: { type: Boolean, default: true },
    content: { type: Schema.Types.Mixed, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  baseSchemaOptions('protocols'),
);

ProtocolSchema.plugin(tenantPlugin);
ProtocolSchema.index({ labId: 1, key: 1, version: 1 }, { unique: true });
ProtocolSchema.index({ labId: 1, active: 1, subspecialty: 1 });
