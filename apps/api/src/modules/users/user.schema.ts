import { Schema, Types } from 'mongoose';
import { ROLES, type Role } from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const UserModelName = 'User';

export interface UserEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  name: string;
  email: string;
  phone: string | null;
  passwordHash: string;
  role: Role;
  subspecialties: string[];
  active: boolean;
  refreshTokenHash: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new Schema<UserEntity>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 160 },
    phone: { type: String, default: null, maxlength: 40 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    subspecialties: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    refreshTokenHash: { type: String, default: null, select: false },
    lastLoginAt: { type: Date, default: null },
  },
  baseSchemaOptions('users'),
);

UserSchema.plugin(tenantPlugin);
UserSchema.index({ labId: 1, email: 1 }, { unique: true });
UserSchema.index({ labId: 1, role: 1, active: 1 });
