import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession } from 'mongoose';
import {
  ruleSchema,
  type Discipline,
  type LabRule,
  type RuleActionConfig,
  type RuleExecution,
  type RuleTrigger,
} from '@lims/shared';
import { currentActor, type Actor } from '../../common/utils/actor';
import { AuditService } from '../audit/audit.service';
import {
  RuleExecutionModelName,
  RuleModelName,
  type RuleEntity,
  type RuleExecutionEntity,
} from './rule.schema';
import { evaluateCondition } from './rule-evaluator';

export interface RuleEvaluationContext {
  discipline: Discipline;
  testCode: string;
  values: Record<string, unknown>;
  patient?: { age?: number | null; sex?: string | null };
  previous?: Record<string, unknown>;
  delta?: Record<string, number>;
  comment?: string | null;
}

export interface RuleMatch {
  rule: LabRule;
  actions: RuleActionConfig[];
  message: string | null;
  execution: RuleExecution;
}

@Injectable()
export class RulesService {
  constructor(
    @InjectModel(RuleModelName) private readonly model: Model<RuleEntity>,
    @InjectModel(RuleExecutionModelName)
    private readonly executionModel: Model<RuleExecutionEntity>,
    private readonly audit: AuditService,
  ) {}

  async list(discipline?: Discipline, active?: boolean) {
    const filter: Record<string, unknown> = {};
    if (discipline) filter.discipline = discipline;
    if (active !== undefined) filter.active = active;
    const rules = await this.model.find(filter).sort({ priority: 1, name: 1 }).exec();
    return rules.map((rule) => this.toRule(rule));
  }

  async create(body: unknown, actor: Actor): Promise<LabRule> {
    const parsed = ruleSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    }
    const existing = await this.model.findOne({ code: parsed.data.code.toUpperCase() }).exec();
    if (existing) throw new BadRequestException('A rule with this code already exists.');
    const rule = await this.model.create({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      active: parsed.data.active ?? true,
      description: parsed.data.description ?? null,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'Rule',
      entityId: rule._id.toString(),
      after: this.toRule(rule),
      metadata: { actor: actor.userName },
    });
    return this.toRule(rule);
  }

  async update(id: string, body: unknown, actor: Actor): Promise<LabRule> {
    const parsed = ruleSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    }
    const rule = await this.model.findById(id).exec();
    if (!rule) throw new NotFoundException('Rule not found.');
    const before = this.toRule(rule);
    Object.assign(rule, parsed.data);
    if (parsed.data.code) rule.code = parsed.data.code.toUpperCase();
    await rule.save();
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'Rule',
      entityId: rule._id.toString(),
      before,
      after: this.toRule(rule),
      metadata: { actor: actor.userName },
    });
    return this.toRule(rule);
  }

  async executions(resultSetId?: string) {
    const filter: Record<string, unknown> = {};
    if (resultSetId) filter.resultSetId = new Types.ObjectId(resultSetId);
    const executions = await this.executionModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
    return executions.map((execution) => this.toExecution(execution));
  }

  async evaluate(
    trigger: RuleTrigger,
    context: RuleEvaluationContext,
    resultSetId: Types.ObjectId,
    caseId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<RuleMatch[]> {
    const rules = await this.model
      .find({
        discipline: context.discipline,
        trigger,
        active: true,
        ...(context.testCode
          ? { $or: [{ testCodes: { $size: 0 } }, { testCodes: context.testCode }] }
          : {}),
      })
      .sort({ priority: 1, name: 1 })
      .session(session ?? null)
      .exec();

    const matches: RuleMatch[] = [];
    const actor = currentActor('Rules engine');
    for (const rule of rules) {
      const matched = evaluateCondition(rule.conditions, {
        testCode: context.testCode,
        discipline: context.discipline,
        patient: context.patient ?? {},
        previous: context.previous ?? {},
        delta: context.delta ?? {},
        comment: context.comment ?? null,
        values: context.values,
        ...context.values,
      });
      const message = this.messageFor(rule, matched, context);
      const execution = await new this.executionModel({
        ruleId: rule._id,
        ruleCode: rule.code,
        ruleName: rule.name,
        resultSetId,
        caseId,
        trigger,
        matched,
        actions: matched ? rule.actions.map((action) => action.type) : [],
        message,
      }).save({ session });
      if (matched) {
        await this.audit.record(
          {
            action: 'UPDATE',
            entityType: 'ResultSet',
            entityId: resultSetId.toString(),
            caseId: caseId.toString(),
            after: { rule: rule.code, actions: rule.actions.map((action) => action.type) },
            metadata: { trigger, message, automated: true },
          },
          session,
        );
        matches.push({
          rule: this.toRule(rule),
          actions: rule.actions,
          message,
          execution: this.toExecution(execution),
        });
      }
    }
    void actor;
    return matches;
  }

  private messageFor(
    rule: RuleEntity,
    matched: boolean,
    context: RuleEvaluationContext,
  ): string | null {
    if (!matched) return null;
    const action = rule.actions.find((item) => item.message)?.message;
    return action ?? `${rule.name} matched for ${context.testCode}.`;
  }

  private toRule(rule: RuleEntity): LabRule {
    return {
      id: rule._id.toString(),
      code: rule.code,
      name: rule.name,
      description: rule.description,
      discipline: rule.discipline,
      testCodes: rule.testCodes,
      trigger: rule.trigger,
      priority: rule.priority,
      active: rule.active,
      conditions: rule.conditions,
      actions: rule.actions,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  private toExecution(execution: RuleExecutionEntity): RuleExecution {
    return {
      id: execution._id.toString(),
      ruleId: execution.ruleId.toString(),
      ruleCode: execution.ruleCode,
      ruleName: execution.ruleName,
      resultSetId: execution.resultSetId ? execution.resultSetId.toString() : '',
      caseId: execution.caseId ? execution.caseId.toString() : '',
      trigger: execution.trigger,
      matched: execution.matched,
      actions: execution.actions,
      message: execution.message,
      createdAt: execution.createdAt.toISOString(),
    };
  }
}
