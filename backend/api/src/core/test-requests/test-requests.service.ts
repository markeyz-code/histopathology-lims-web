import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession } from 'mongoose';
import type { Discipline, TestRequest } from '@lims/shared';
import type { Actor } from '../../common/utils/actor';
import { buildPaginated } from '../../common/utils/format';
import { toTestRequest } from '../../common/serializers/entities';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { TestRequestModelName, type TestRequestEntity } from './test-request.schema';
import type { TestRequestQueryDto } from './dto/test-request.dto';

const DEFAULT_TEST: Record<Discipline, { code: string; name: string }> = {
  HISTOPATHOLOGY: { code: 'HISTO', name: 'Histopathology examination' },
  HAEMATOLOGY: { code: 'FBC', name: 'Full blood count' },
  CHEMICAL_PATHOLOGY: { code: 'CHEM', name: 'Clinical chemistry panel' },
  MICROBIOLOGY: { code: 'MICRO', name: 'Microbiology culture' },
};

@Injectable()
export class TestRequestsService {
  constructor(
    @InjectModel(TestRequestModelName)
    private readonly model: Model<TestRequestEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
  ) {}

  async createForCase(
    caseDoc: CaseEntity,
    discipline: Discipline,
    actor: Actor,
    session: ClientSession,
    options: { code?: string; name?: string } = {},
  ): Promise<TestRequest> {
    const defaults = DEFAULT_TEST[discipline];
    const request = new this.model({
      caseId: caseDoc._id,
      accessionNumber: caseDoc.accessionNumber,
      discipline,
      code: options.code?.trim().toUpperCase() || defaults.code,
      name: options.name?.trim() || defaults.name,
      status: this.statusFromCase(caseDoc.status),
      priority: caseDoc.priority,
      requestedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      requestedAt: caseDoc.receivedAt,
    });
    await request.save({ session });
    return toTestRequest(request);
  }

  async forCase(caseId: string, allowed?: Discipline[]): Promise<TestRequest[]> {
    const filter: Record<string, unknown> = { caseId: new Types.ObjectId(caseId) };
    if (allowed) filter.discipline = { $in: allowed };
    const requests = await this.model.find(filter).sort({ requestedAt: 1, createdAt: 1 }).exec();
    return requests.map(toTestRequest);
  }

  async forCases(caseIds: Types.ObjectId[]): Promise<Map<string, TestRequest[]>> {
    if (caseIds.length === 0) return new Map();
    const requests = await this.model
      .find({ caseId: { $in: caseIds } })
      .sort({ requestedAt: 1 })
      .exec();
    const map = new Map<string, TestRequest[]>();
    for (const request of requests) {
      const key = request.caseId.toString();
      const list = map.get(key) ?? [];
      list.push(toTestRequest(request));
      map.set(key, list);
    }
    return map;
  }

  async list(query: TestRequestQueryDto, allowed?: Discipline[]) {
    const filter: Record<string, unknown> = {};
    if (allowed) filter.discipline = { $in: allowed };
    if (query.caseId) filter.caseId = new Types.ObjectId(query.caseId);
    if (query.discipline) filter.discipline = query.discipline;
    if (query.status) filter.status = query.status;
    const [requests, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ requestedAt: -1, createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return buildPaginated(requests.map(toTestRequest), total, query.page, query.limit);
  }

  async caseIdsForDiscipline(discipline: Discipline): Promise<Types.ObjectId[]> {
    const requests = await this.model
      .find({ discipline })
      .select('caseId')
      .distinct('caseId')
      .exec();
    return requests as Types.ObjectId[];
  }

  async updateStatusForCase(
    caseId: Types.ObjectId,
    caseStatus: CaseEntity['status'],
    session: ClientSession,
  ): Promise<void> {
    await this.model
      .updateMany({ caseId }, { $set: { status: this.statusFromCase(caseStatus) } }, { session })
      .exec();
  }

  async markReleased(caseId: Types.ObjectId, session: ClientSession): Promise<void> {
    await this.model.updateMany({ caseId }, { $set: { status: 'RELEASED' } }, { session }).exec();
  }

  async findEntity(id: string): Promise<TestRequestEntity | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.model.findById(id).exec();
  }

  async setStatus(
    id: Types.ObjectId,
    status: TestRequestEntity['status'],
    session?: ClientSession,
  ): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { status } }, { session }).exec();
  }

  async ensureHistopathology(caseId: string): Promise<TestRequest> {
    const caseDoc = await this.caseModel.findById(caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    const existing = await this.model
      .findOne({ caseId: caseDoc._id, discipline: 'HISTOPATHOLOGY' })
      .exec();
    if (existing) return toTestRequest(existing);
    const request = await this.model.create({
      caseId: caseDoc._id,
      accessionNumber: caseDoc.accessionNumber,
      discipline: 'HISTOPATHOLOGY',
      code: 'HISTO',
      name: 'Histopathology examination',
      status: this.statusFromCase(caseDoc.status),
      priority: caseDoc.priority,
      requestedBy: caseDoc.createdBy,
      requestedAt: caseDoc.receivedAt,
    });
    return toTestRequest(request);
  }

  private statusFromCase(status: CaseEntity['status']) {
    switch (status) {
      case 'RECEIVED':
        return 'RECEIVED' as const;
      case 'IN_PROGRESS':
        return 'IN_PROGRESS' as const;
      case 'PENDING_REVIEW':
        return 'PENDING_REVIEW' as const;
      case 'REPORTED':
        return 'VERIFIED' as const;
      case 'AMENDED':
        return 'VERIFIED' as const;
      default:
        return 'RECEIVED' as const;
    }
  }
}
