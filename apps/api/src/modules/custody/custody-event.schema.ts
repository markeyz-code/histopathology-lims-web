import { Schema, Types } from 'mongoose';
import {
  CUSTODY_ENTITY_TYPES,
  ROLES,
  STATIONS,
  type CustodyEntityType,
  type Role,
  type Station,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';
import { makeAppendOnly } from '../../common/database/append-only';

export const CustodyEventModelName = 'CustodyEvent';

export interface CustodyEventEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  entityType: CustodyEntityType;
  entityId: Types.ObjectId;
  caseId: Types.ObjectId | null;
  eventType: string;
  station: Station | null;
  fromState: string | null;
  toState: string;
  reason: string | null;
  userId: Types.ObjectId;
  userName: string;
  userRole: Role | null;
  timestamp: Date;
  barcode: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const CustodyEventSchema = new Schema<CustodyEventEntity>(
  {
    entityType: { type: String, enum: CUSTODY_ENTITY_TYPES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null },
    eventType: { type: String, required: true, maxlength: 40 },
    station: { type: String, enum: STATIONS, default: null },
    fromState: { type: String, default: null },
    toState: { type: String, required: true },
    reason: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userRole: { type: String, enum: ROLES, default: null },
    timestamp: { type: Date, required: true, default: Date.now },
    barcode: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  baseSchemaOptions('custody_events'),
);

CustodyEventSchema.plugin(tenantPlugin);
makeAppendOnly(CustodyEventSchema, 'Custody event');
CustodyEventSchema.index({ labId: 1, entityType: 1, entityId: 1, timestamp: -1 });
CustodyEventSchema.index({ labId: 1, caseId: 1, timestamp: -1 });
CustodyEventSchema.index({ labId: 1, timestamp: -1 });
