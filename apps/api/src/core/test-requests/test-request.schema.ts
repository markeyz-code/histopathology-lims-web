import { Schema, Types } from 'mongoose';
import {
  DISCIPLINES,
  PRIORITIES,
  TEST_REQUEST_STATUSES,
  type Discipline,
  type Priority,
  type TestRequestStatus,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const TestRequestModelName = 'TestRequest';

export interface TestRequestEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  caseId: Types.ObjectId;
  accessionNumber: string;
  discipline: Discipline;
  code: string;
  name: string;
  status: TestRequestStatus;
  priority: Priority;
  requestedBy: Types.ObjectId | null;
  requestedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const TestRequestSchema = new Schema<TestRequestEntity>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    accessionNumber: { type: String, required: true, trim: true, maxlength: 64 },
    discipline: { type: String, enum: DISCIPLINES, required: true },
    code: { type: String, required: true, trim: true, maxlength: 80 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    status: { type: String, enum: TEST_REQUEST_STATUSES, required: true, default: 'RECEIVED' },
    priority: { type: String, enum: PRIORITIES, required: true, default: 'ROUTINE' },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    requestedAt: { type: Date, required: true, default: Date.now },
  },
  baseSchemaOptions('test_requests'),
);

TestRequestSchema.plugin(tenantPlugin);
TestRequestSchema.index({ labId: 1, caseId: 1, discipline: 1, code: 1 }, { unique: true });
TestRequestSchema.index({ labId: 1, discipline: 1, status: 1, priority: 1 });
TestRequestSchema.index({ labId: 1, accessionNumber: 1 });
