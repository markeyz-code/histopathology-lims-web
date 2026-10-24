import { Schema, Types } from 'mongoose';
import {
  INSTRUMENT_MESSAGE_STATUSES,
  INSTRUMENT_PROTOCOLS,
  type InstrumentMessageStatus,
  type InstrumentProtocol,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const InstrumentMessageModelName = 'InstrumentMessage';

export interface InstrumentMessageEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  protocol: InstrumentProtocol;
  labCode: string | null;
  accessionNumber: string | null;
  testCode: string | null;
  patientName: string | null;
  values: Array<{ code: string; value: string; unit: string | null }>;
  status: InstrumentMessageStatus;
  error: string | null;
  rawMessage: string;
  createdAt: Date;
  updatedAt: Date;
}
export const InstrumentMessageSchema = new Schema<InstrumentMessageEntity>(
  {
    protocol: { type: String, enum: INSTRUMENT_PROTOCOLS, required: true },
    labCode: { type: String, default: null },
    accessionNumber: { type: String, default: null },
    testCode: { type: String, default: null },
    patientName: { type: String, default: null },
    values: { type: [{ code: String, value: String, unit: String }], default: [] },
    status: { type: String, enum: INSTRUMENT_MESSAGE_STATUSES, default: 'RECEIVED' },
    error: { type: String, default: null },
    rawMessage: { type: String, required: true },
  },
  baseSchemaOptions('instrument_messages'),
);
InstrumentMessageSchema.plugin(tenantPlugin);
InstrumentMessageSchema.index({ labId: 1, createdAt: -1 });
InstrumentMessageSchema.index({ labId: 1, accessionNumber: 1 });
