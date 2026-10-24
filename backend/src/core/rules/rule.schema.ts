import { Schema, Types } from 'mongoose';
import {
  DISCIPLINES,
  RULE_ACTIONS,
  RULE_TRIGGERS,
  type Discipline,
  type RuleActionConfig,
  type RuleCondition,
  type RuleTrigger,
} from '@lims/shared';
import { baseSchemaOptions } from '../../common/database/schema-options';
import { tenantPlugin } from '../../common/database/tenant.plugin';

export const RuleModelName = 'Rule';
export const RuleExecutionModelName = 'RuleExecution';

export interface RuleEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  code: string;
  name: string;
  description: string | null;
  discipline: Discipline;
  testCodes: string[];
  trigger: RuleTrigger;
  priority: number;
  active: boolean;
  conditions: RuleCondition;
  actions: RuleActionConfig[];
  createdAt: Date;
  updatedAt: Date;
}

export const RuleSchema = new Schema<RuleEntity>(
  {
    code: { type: String, required: true, trim: true, maxlength: 60 },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 1_000, default: null },
    discipline: { type: String, enum: DISCIPLINES, required: true },
    testCodes: { type: [String], default: [] },
    trigger: { type: String, enum: RULE_TRIGGERS, required: true },
    priority: { type: Number, default: 100 },
    active: { type: Boolean, default: true },
    conditions: { type: Schema.Types.Mixed, required: true },
    actions: { type: [{ type: Schema.Types.Mixed }], default: [] },
  },
  baseSchemaOptions('rules'),
);
RuleSchema.plugin(tenantPlugin);
RuleSchema.index({ labId: 1, code: 1 }, { unique: true });
RuleSchema.index({ labId: 1, discipline: 1, trigger: 1, active: 1 });
void RULE_ACTIONS;

export interface RuleExecutionEntity {
  _id: Types.ObjectId;
  labId: Types.ObjectId;
  ruleId: Types.ObjectId;
  ruleCode: string;
  ruleName: string;
  resultSetId: Types.ObjectId | null;
  caseId: Types.ObjectId | null;
  trigger: RuleTrigger;
  matched: boolean;
  actions: string[];
  message: string | null;
  createdAt: Date;
}

export const RuleExecutionSchema = new Schema<RuleExecutionEntity>(
  {
    ruleId: { type: Schema.Types.ObjectId, ref: RuleModelName, required: true },
    ruleCode: { type: String, required: true },
    ruleName: { type: String, required: true },
    resultSetId: { type: Schema.Types.ObjectId, ref: 'ResultSet', default: null },
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', default: null },
    trigger: { type: String, enum: RULE_TRIGGERS, required: true },
    matched: { type: Boolean, required: true },
    actions: { type: [String], default: [] },
    message: { type: String, maxlength: 2_000, default: null },
  },
  baseSchemaOptions('rule_executions'),
);
RuleExecutionSchema.plugin(tenantPlugin);
RuleExecutionSchema.index({ labId: 1, resultSetId: 1, createdAt: -1 });
RuleExecutionSchema.index({ labId: 1, ruleId: 1, createdAt: -1 });
