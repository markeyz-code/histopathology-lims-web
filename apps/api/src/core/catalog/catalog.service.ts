import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  panelSchema,
  testDefinitionSchema,
  type Discipline,
  type Panel,
  type TestDefinition,
  type TestDefinitionInput,
} from '@lims/shared';
import { buildPaginated } from '../../common/utils/format';
import type { Actor } from '../../common/utils/actor';
import { AuditService } from '../audit/audit.service';
import {
  PanelModelName,
  TestDefinitionModelName,
  type PanelEntity,
  type TestDefinitionEntity,
} from './test-definition.schema';

@Injectable()
export class CatalogService {
  constructor(
    @InjectModel(TestDefinitionModelName)
    private readonly testModel: Model<TestDefinitionEntity>,
    @InjectModel(PanelModelName) private readonly panelModel: Model<PanelEntity>,
    private readonly audit: AuditService,
  ) {}

  async listTests(query: {
    discipline?: Discipline;
    q?: string;
    active?: boolean;
    page: number;
    limit: number;
  }) {
    const filter: Record<string, unknown> = {};
    if (query.discipline) filter.discipline = query.discipline;
    if (query.active !== undefined) filter.active = query.active;
    if (query.q) {
      const needle = query.q.trim();
      filter.$or = [
        { code: { $regex: needle, $options: 'i' } },
        { name: { $regex: needle, $options: 'i' } },
      ];
    }
    const [tests, total] = await Promise.all([
      this.testModel
        .find(filter)
        .sort({ discipline: 1, name: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.testModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(
      tests.map((test) => this.toTest(test)),
      total,
      query.page,
      query.limit,
    );
  }

  async listPanels(query: { discipline?: Discipline; page: number; limit: number }) {
    const filter: Record<string, unknown> = {};
    if (query.discipline) filter.discipline = query.discipline;
    const [panels, total] = await Promise.all([
      this.panelModel
        .find(filter)
        .sort({ discipline: 1, name: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.panelModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(
      panels.map((panel) => this.toPanel(panel)),
      total,
      query.page,
      query.limit,
    );
  }

  async findTest(discipline: Discipline, code: string): Promise<TestDefinition | null> {
    const test = await this.testModel.findOne({ discipline, code: code.toUpperCase() }).exec();
    return test ? this.toTest(test) : null;
  }

  async createTest(body: unknown, actor: Actor): Promise<TestDefinition> {
    const parsed = testDefinitionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    }
    const existing = await this.testModel
      .findOne({ discipline: parsed.data.discipline, code: parsed.data.code.toUpperCase() })
      .exec();
    if (existing) throw new ConflictException('A test with this code already exists.');
    const test = await this.testModel.create({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      method: parsed.data.method ?? null,
      active: parsed.data.active ?? true,
      analytes: this.normalizeAnalytes(parsed.data.analytes),
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'TestDefinition',
      entityId: test._id.toString(),
      after: this.toTest(test),
      metadata: { actor: actor.userName, discipline: test.discipline },
    });
    return this.toTest(test);
  }

  async updateTest(id: string, body: unknown, actor: Actor): Promise<TestDefinition> {
    const parsed = testDefinitionSchema.partial().safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    }
    const test = await this.testModel.findById(id).exec();
    if (!test) throw new NotFoundException('Test definition not found.');
    const before = this.toTest(test);
    if (parsed.data.code) test.code = parsed.data.code.toUpperCase();
    if (parsed.data.name) test.name = parsed.data.name;
    if (parsed.data.discipline) test.discipline = parsed.data.discipline;
    if (parsed.data.specimenType) test.specimenType = parsed.data.specimenType;
    if (parsed.data.method !== undefined) test.method = parsed.data.method ?? null;
    if (parsed.data.analytes) test.analytes = this.normalizeAnalytes(parsed.data.analytes);
    if (parsed.data.active !== undefined) test.active = parsed.data.active;
    await test.save();
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'TestDefinition',
      entityId: test._id.toString(),
      before,
      after: this.toTest(test),
      metadata: { actor: actor.userName },
    });
    return this.toTest(test);
  }

  async createPanel(body: unknown, actor: Actor): Promise<Panel> {
    const parsed = panelSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    }
    const panel = await this.panelModel.create({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      active: parsed.data.active ?? true,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'Panel',
      entityId: panel._id.toString(),
      after: this.toPanel(panel),
      metadata: { actor: actor.userName },
    });
    return this.toPanel(panel);
  }

  private normalizeAnalytes(
    analytes: TestDefinitionInput['analytes'],
  ): TestDefinitionEntity['analytes'] {
    return analytes.map((analyte) => ({
      ...analyte,
      unit: analyte.unit ?? null,
      formula: analyte.formula ?? null,
      required: analyte.required ?? false,
      criticalLow: analyte.criticalLow ?? null,
      criticalHigh: analyte.criticalHigh ?? null,
      referenceRanges: (analyte.referenceRanges ?? []).map((range) => ({
        low: range.low ?? null,
        high: range.high ?? null,
        sex: range.sex ?? null,
        minAge: range.minAge ?? null,
        maxAge: range.maxAge ?? null,
      })),
    }));
  }

  private toTest(test: TestDefinitionEntity): TestDefinition {
    return {
      id: test._id.toString(),
      discipline: test.discipline,
      code: test.code,
      name: test.name,
      specimenType: test.specimenType,
      method: test.method,
      analytes: test.analytes,
      active: test.active,
      createdAt: test.createdAt.toISOString(),
      updatedAt: test.updatedAt.toISOString(),
    };
  }

  private toPanel(panel: PanelEntity): Panel {
    return {
      id: panel._id.toString(),
      discipline: panel.discipline,
      code: panel.code,
      name: panel.name,
      testCodes: panel.testCodes,
      active: panel.active,
    };
  }
}
