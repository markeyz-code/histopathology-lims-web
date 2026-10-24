import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  qcMaterialSchema,
  qcRunSchema,
  type Discipline,
  type QcMaterial,
  type QcRun,
} from '@lims/shared';
import { buildPaginated } from '../../common/utils/format';
import type { Actor } from '../../common/utils/actor';
import { toUserSummary } from '../../common/serializers/entities';
import { UserModelName, type UserEntity } from '../users/user.schema';
import {
  QcMaterialModelName,
  QcRunModelName,
  type QcMaterialEntity,
  type QcRunEntity,
} from './qc.schema';
import { evaluateWestgard } from './westgard';

@Injectable()
export class QcService {
  constructor(
    @InjectModel(QcMaterialModelName) private readonly materialModel: Model<QcMaterialEntity>,
    @InjectModel(QcRunModelName) private readonly runModel: Model<QcRunEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
  ) {}

  async listMaterials(discipline?: Discipline) {
    const materials = await this.materialModel
      .find(discipline ? { discipline } : {})
      .sort({ testCode: 1, level: 1 })
      .exec();
    return materials.map((material) => this.toMaterial(material));
  }

  async createMaterial(body: unknown, actor: Actor): Promise<QcMaterial> {
    const parsed = qcMaterialSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    }
    const material = await this.materialModel.create({
      ...parsed.data,
      testCode: parsed.data.testCode.toUpperCase(),
      unit: parsed.data.unit ?? null,
      active: parsed.data.active ?? true,
    });
    void actor;
    return this.toMaterial(material);
  }

  async listRuns(query: {
    discipline?: Discipline;
    materialId?: string;
    page: number;
    limit: number;
  }) {
    const filter: Record<string, unknown> = {};
    if (query.materialId) filter.materialId = new Types.ObjectId(query.materialId);
    if (query.discipline) {
      const materials = await this.materialModel
        .find({ discipline: query.discipline })
        .select('_id')
        .exec();
      filter.materialId = { $in: materials.map((material) => material._id) };
    }
    const [runs, total] = await Promise.all([
      this.runModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.runModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(
      await Promise.all(runs.map((run) => this.toRun(run))),
      total,
      query.page,
      query.limit,
    );
  }

  async run(body: unknown, actor: Actor): Promise<QcRun> {
    const parsed = qcRunSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    }
    const material = await this.materialModel.findById(parsed.data.materialId).exec();
    if (!material) throw new NotFoundException('QC material not found.');
    const evaluation = evaluateWestgard(parsed.data.values, material.targetMean, material.targetSd);
    const run = await this.runModel.create({
      materialId: material._id,
      testCode: material.testCode,
      analyteKey: material.analyteKey,
      mean: material.targetMean,
      sd: material.targetSd,
      values: parsed.data.values,
      points: evaluation.points,
      status: evaluation.status,
      violations: evaluation.violations,
      comment: parsed.data.comment ?? null,
      performedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
    });
    return this.toRun(run);
  }

  private toMaterial(material: QcMaterialEntity): QcMaterial {
    return {
      id: material._id.toString(),
      discipline: material.discipline,
      name: material.name,
      lotNumber: material.lotNumber,
      level: material.level,
      testCode: material.testCode,
      analyteKey: material.analyteKey,
      targetMean: material.targetMean,
      targetSd: material.targetSd,
      unit: material.unit,
      active: material.active,
    };
  }

  private async toRun(run: QcRunEntity): Promise<QcRun> {
    const [material, performer] = await Promise.all([
      this.materialModel.findById(run.materialId).exec(),
      run.performedBy ? this.userModel.findById(run.performedBy).exec() : null,
    ]);
    return {
      id: run._id.toString(),
      materialId: run.materialId.toString(),
      materialName: material?.name ?? 'QC material',
      testCode: run.testCode,
      analyteKey: run.analyteKey,
      mean: run.mean,
      sd: run.sd,
      values: run.values,
      points: run.points,
      status: run.status,
      violations: run.violations,
      performedBy: performer ? toUserSummary(performer) : null,
      createdAt: run.createdAt.toISOString(),
    };
  }
}
