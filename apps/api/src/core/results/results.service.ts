import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession, type Connection } from 'mongoose';
import {
  type AnalyteDefinition,
  type CumulativeReport,
  type Discipline,
  type ReferenceRange,
  type ResultFlag,
  type ResultSet,
  type ResultValue,
  type ResultVersion,
  type ResultWorklistItem,
  type TestDefinition,
} from '@lims/shared';
import { withTransaction } from '../../common/utils/transaction';
import { toPatient, toTestRequest, toUserSummary } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { RulesService } from '../rules/rules.service';
import { TestRequestsService } from '../test-requests/test-requests.service';
import { TestRequestModelName, type TestRequestEntity } from '../test-requests/test-request.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import {
  ResultSetModelName,
  ResultVersionModelName,
  type ResultSetEntity,
  type ResultVersionEntity,
} from './result.schema';
import { calculateAnalytes } from './result-calculator';

const RESULT_STATUS_TO_REQUEST = {
  DRAFT: 'IN_PROGRESS',
  RESULTED: 'RESULTED',
  VERIFIED: 'VERIFIED',
  RELEASED: 'RELEASED',
  CANCELLED: 'CANCELLED',
} as const;

@Injectable()
export class ResultsService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ResultSetModelName) private readonly resultModel: Model<ResultSetEntity>,
    @InjectModel(ResultVersionModelName)
    private readonly versionModel: Model<ResultVersionEntity>,
    @InjectModel(TestRequestModelName) private readonly requestModel: Model<TestRequestEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    private readonly catalog: CatalogService,
    private readonly rules: RulesService,
    private readonly testRequests: TestRequestsService,
    private readonly audit: AuditService,
  ) {}

  async worklist(discipline: Discipline, user: AuthenticatedUser): Promise<ResultWorklistItem[]> {
    const allowed = this.clinicalDisciplines(user);
    if (allowed.length > 0 && !allowed.includes(discipline)) return [];
    const requests = await this.requestModel
      .find({
        discipline,
        status: {
          $in: ['RECEIVED', 'COLLECTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'RESULTED', 'VERIFIED'],
        },
      })
      .sort({ priority: 1, requestedAt: 1 })
      .limit(100)
      .exec();
    const results = await this.resultModel
      .find({ testRequestId: { $in: requests.map((request) => request._id) } })
      .exec();
    const resultMap = new Map(results.map((result) => [result.testRequestId.toString(), result]));
    const definitions = await Promise.all(
      requests.map((request) => this.catalog.findTest(request.discipline, request.code)),
    );
    return Promise.all(
      requests.map(async (request, index) => ({
        testRequest: toTestRequest(request),
        result: resultMap.get(request._id.toString())
          ? await this.toResult(resultMap.get(request._id.toString())!)
          : null,
        testDefinition: definitions[index] ?? null,
      })),
    );
  }

  async getById(id: string): Promise<ResultSet> {
    const result = await this.resultModel.findById(id).exec();
    if (!result) throw new NotFoundException('Result not found.');
    return this.toResult(result);
  }

  async create(testRequestId: string, actor: AuthenticatedUser): Promise<ResultSet> {
    const resultId = await withTransaction(this.connection, async (session) => {
      const request = await this.requestModel.findById(testRequestId).session(session).exec();
      if (!request) throw new NotFoundException('Test request not found.');
      this.assertAccess(actor, request.discipline);
      if (request.status === 'RELEASED' || request.status === 'CANCELLED') {
        throw new ConflictException('This test request is closed.');
      }
      const existing = await this.resultModel
        .findOne({ testRequestId: request._id })
        .session(session)
        .exec();
      if (existing) throw new ConflictException('A result already exists for this test request.');
      const caseDoc = await this.caseModel.findById(request.caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');
      const definition = await this.catalog.findTest(request.discipline, request.code);
      if (!definition)
        throw new BadRequestException(`No active catalogue definition for ${request.code}.`);
      const values = this.blankValues(definition);
      const result = new this.resultModel({
        caseId: caseDoc._id,
        patientId: caseDoc.patientId,
        testRequestId: request._id,
        discipline: request.discipline,
        testCode: request.code,
        testName: definition.name,
        status: 'DRAFT',
        currentVersion: 1,
        values,
        enteredBy: new Types.ObjectId(actor.id),
      });
      await result.save({ session });
      await this.appendVersion(result, 'DRAFT_SAVE', values, null, actor, session);
      await this.testRequests.setStatus(request._id, 'IN_PROGRESS', session);
      await this.audit.record(
        {
          action: 'CREATE',
          entityType: 'ResultSet',
          entityId: result._id.toString(),
          caseId: caseDoc._id.toString(),
          after: { testCode: result.testCode, status: result.status },
        },
        session,
      );
      return result._id.toString();
    });
    return this.getById(resultId);
  }

  async update(
    id: string,
    input: {
      values: Array<{ analyteKey: string; value: number | string | null }>;
      comment?: string | null;
    },
    actor: AuthenticatedUser,
  ): Promise<ResultSet> {
    await withTransaction(this.connection, async (session) => {
      const result = await this.resultModel.findById(id).session(session).exec();
      if (!result) throw new NotFoundException('Result not found.');
      this.assertAccess(actor, result.discipline);
      if (result.status === 'VERIFIED' || result.status === 'RELEASED') {
        throw new ConflictException('Verified results are locked.');
      }
      const request = await this.requestModel
        .findById(result.testRequestId)
        .session(session)
        .exec();
      if (!request) throw new NotFoundException('Test request not found.');
      const caseDoc = await this.caseModel.findById(result.caseId).session(session).exec();
      const patient = await this.patientModel.findById(result.patientId).session(session).exec();
      const definition = await this.catalog.findTest(result.discipline, result.testCode);
      if (!caseDoc || !patient || !definition)
        throw new NotFoundException('Result context is missing.');

      const values = this.computeValues(definition, input.values, patient);
      const previous = await this.previousResult(patient._id, result.testCode, result._id, session);
      const previousValues = previous ? this.valueMap(previous.values) : {};
      const delta = this.deltaMap(values, previous?.values ?? []);
      result.values = values;
      result.comment = input.comment ?? null;
      result.critical = values.some((value) => value.critical);
      result.currentVersion += 1;
      result.status = this.complete(definition, values) ? 'RESULTED' : 'DRAFT';
      await result.save({ session });

      const matches = await this.rules.evaluate(
        'RESULT_SAVE',
        {
          discipline: result.discipline,
          testCode: result.testCode,
          values: this.valueMap(values),
          patient: { age: patient.age, sex: patient.sex },
          previous: previousValues,
          delta,
          comment: result.comment,
        },
        result._id,
        caseDoc._id,
        session,
      );

      for (const match of matches) {
        for (const action of match.actions) {
          if (
            action.type === 'AUTO_VERIFY' &&
            this.complete(definition, values) &&
            !result.critical
          ) {
            result.status = 'VERIFIED';
            result.autoVerified = true;
            result.verifiedAt = new Date();
            result.verifiedBy = request.requestedBy ?? null;
          }
          if (action.type === 'REFLEX_TEST' && action.testCode) {
            await this.addReflexRequest(
              caseDoc,
              result.discipline,
              action.testCode,
              actor,
              session,
            );
          }
        }
      }
      await result.save({ session });
      await this.appendVersion(
        result,
        result.status === 'VERIFIED'
          ? 'VERIFY'
          : result.status === 'RESULTED'
            ? 'RESULTED'
            : 'DRAFT_SAVE',
        values,
        result.comment,
        actor,
        session,
      );
      await this.testRequests.setStatus(
        request._id,
        RESULT_STATUS_TO_REQUEST[result.status],
        session,
      );
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'ResultSet',
          entityId: result._id.toString(),
          caseId: result.caseId.toString(),
          after: {
            status: result.status,
            version: result.currentVersion,
            flags: values.map((value) => value.flag),
          },
          metadata: { rules: matches.map((match) => match.rule.code) },
        },
        session,
      );
    });
    return this.getById(id);
  }

  async verify(id: string, actor: AuthenticatedUser): Promise<ResultSet> {
    await withTransaction(this.connection, async (session) => {
      const result = await this.resultModel.findById(id).session(session).exec();
      if (!result) throw new NotFoundException('Result not found.');
      this.assertAccess(actor, result.discipline);
      if (result.status !== 'RESULTED' && result.status !== 'DRAFT') {
        throw new ConflictException('Only a resulted draft can be verified.');
      }
      if (result.critical && !result.criticalAcknowledgedAt) {
        throw new ConflictException('Acknowledge the critical value before verification.');
      }
      const request = await this.requestModel
        .findById(result.testRequestId)
        .session(session)
        .exec();
      if (!request) throw new NotFoundException('Test request not found.');
      result.status = 'VERIFIED';
      result.verifiedBy = new Types.ObjectId(actor.id);
      result.verifiedAt = new Date();
      await result.save({ session });
      await this.appendVersion(result, 'VERIFY', result.values, result.comment, actor, session);
      await this.testRequests.setStatus(request._id, 'VERIFIED', session);
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'ResultSet',
          entityId: result._id.toString(),
          caseId: result.caseId.toString(),
          after: { status: 'VERIFIED' },
          metadata: { verifiedBy: actor.email },
        },
        session,
      );
    });
    return this.getById(id);
  }

  async release(id: string, actor: AuthenticatedUser): Promise<ResultSet> {
    await withTransaction(this.connection, async (session) => {
      const result = await this.resultModel.findById(id).session(session).exec();
      if (!result) throw new NotFoundException('Result not found.');
      this.assertAccess(actor, result.discipline);
      if (result.status !== 'VERIFIED')
        throw new ConflictException('Verify the result before release.');
      result.status = 'RELEASED';
      result.releasedAt = new Date();
      await result.save({ session });
      await this.appendVersion(result, 'RELEASE', result.values, result.comment, actor, session);
      const request = await this.requestModel
        .findById(result.testRequestId)
        .session(session)
        .exec();
      if (request) await this.testRequests.setStatus(request._id, 'RELEASED', session);
      await this.audit.record(
        {
          action: 'RELEASE',
          entityType: 'ResultSet',
          entityId: result._id.toString(),
          caseId: result.caseId.toString(),
          after: { status: 'RELEASED' },
        },
        session,
      );
    });
    return this.getById(id);
  }

  async acknowledgeCritical(
    id: string,
    note: string,
    actor: AuthenticatedUser,
  ): Promise<ResultSet> {
    const result = await this.resultModel.findById(id).exec();
    if (!result) throw new NotFoundException('Result not found.');
    if (!result.critical) throw new BadRequestException('This result has no critical value.');
    result.criticalAcknowledgedAt = new Date();
    result.criticalAcknowledgedBy = new Types.ObjectId(actor.id);
    result.criticalAckNote = note;
    await result.save();
    return this.getById(id);
  }

  async versions(id: string): Promise<ResultVersion[]> {
    const versions = await this.versionModel
      .find({ resultSetId: new Types.ObjectId(id) })
      .sort({ version: -1 })
      .exec();
    return Promise.all(versions.map((version) => this.toVersion(version)));
  }

  async executions(id: string) {
    return this.rules.executions(id);
  }

  async cumulative(
    patientId: string,
    from?: string,
    to?: string,
    disciplines?: Discipline[],
  ): Promise<CumulativeReport> {
    const patient = await this.patientModel.findById(patientId).exec();
    if (!patient) throw new NotFoundException('Patient not found.');
    const filter: Record<string, unknown> = {
      patientId: patient._id,
      status: { $in: ['VERIFIED', 'RELEASED'] },
    };
    if (disciplines && disciplines.length > 0) filter.discipline = { $in: disciplines };
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      filter.createdAt = range;
    }
    const results = await this.resultModel.find(filter).sort({ createdAt: -1 }).exec();
    const grouped = new Map<string, ResultSetEntity[]>();
    for (const result of results) {
      const key = `${result.discipline}:${result.testCode}`;
      grouped.set(key, [...(grouped.get(key) ?? []), result]);
    }
    const cumulative = await Promise.all(
      Array.from(grouped.values()).map(async (group) => ({
        testCode: group[0]!.testCode,
        testName: group[0]!.testName,
        discipline: group[0]!.discipline,
        latest: await this.toResult(group[0]!),
        history: await Promise.all(group.map((item) => this.toResult(item))),
      })),
    );
    return {
      patient: toPatient(patient),
      from: from ?? new Date(0).toISOString(),
      to: to ?? new Date().toISOString(),
      disciplines: Array.from(new Set(results.map((result) => result.discipline))),
      results: cumulative,
    };
  }

  private blankValues(definition: TestDefinition): ResultValue[] {
    return definition.analytes.map((analyte) => ({
      analyteKey: analyte.key,
      analyteName: analyte.name,
      value: null,
      unit: analyte.unit ?? null,
      flag: 'NORMAL',
      critical: false,
      referenceText: this.referenceText(analyte, null),
    }));
  }

  private computeValues(
    definition: TestDefinition,
    inputs: Array<{ analyteKey: string; value: number | string | null }>,
    patient: PatientEntity,
  ): ResultValue[] {
    const map = new Map(inputs.map((input) => [input.analyteKey, input.value]));
    const values: ResultValue[] = definition.analytes.map((analyte) => {
      const raw = map.get(analyte.key) ?? null;
      const value = this.normalizeValue(analyte, raw);
      const computed = this.flagFor(analyte, value, patient);
      return {
        analyteKey: analyte.key,
        analyteName: analyte.name,
        value,
        unit: analyte.unit ?? null,
        flag: computed.flag,
        critical: computed.critical,
        referenceText: this.referenceText(analyte, patient),
      };
    });
    return calculateAnalytes(definition.analytes, values).map((value) => {
      const analyte = definition.analytes.find((item) => item.key === value.analyteKey);
      if (!analyte) return value;
      const computed = this.flagFor(analyte, value.value, patient);
      return {
        ...value,
        flag: computed.flag,
        critical: computed.critical,
        referenceText: this.referenceText(analyte, patient),
      };
    });
  }

  private normalizeValue(
    analyte: AnalyteDefinition,
    raw: number | string | null,
  ): number | string | null {
    if (raw === null || raw === '') return null;
    if (analyte.resultType === 'NUMERIC' || analyte.resultType === 'CALCULATED') {
      const value = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(value) ? value : null;
    }
    return String(raw);
  }

  private flagFor(
    analyte: AnalyteDefinition,
    value: number | string | null,
    patient: PatientEntity,
  ): { flag: ResultFlag; critical: boolean } {
    if (typeof value !== 'number') {
      return { flag: value === null ? 'NORMAL' : 'NORMAL', critical: false };
    }
    const range = this.pickRange(analyte.referenceRanges, patient);
    if (
      analyte.criticalLow !== null &&
      analyte.criticalLow !== undefined &&
      value < analyte.criticalLow
    ) {
      return { flag: 'CRITICAL_LOW', critical: true };
    }
    if (
      analyte.criticalHigh !== null &&
      analyte.criticalHigh !== undefined &&
      value > analyte.criticalHigh
    ) {
      return { flag: 'CRITICAL_HIGH', critical: true };
    }
    if (!range) return { flag: 'NORMAL', critical: false };
    if (range.low !== null && range.low !== undefined && value < range.low) {
      return { flag: 'LOW', critical: false };
    }
    if (range.high !== null && range.high !== undefined && value > range.high) {
      return { flag: 'HIGH', critical: false };
    }
    return { flag: 'NORMAL', critical: false };
  }

  private pickRange(ranges: ReferenceRange[], patient: PatientEntity): ReferenceRange | null {
    return (
      ranges.find((range) => {
        if (range.sex && range.sex !== patient.sex) return false;
        if (
          range.minAge !== null &&
          range.minAge !== undefined &&
          (patient.age ?? 0) < range.minAge
        )
          return false;
        if (
          range.maxAge !== null &&
          range.maxAge !== undefined &&
          (patient.age ?? 0) > range.maxAge
        )
          return false;
        return true;
      }) ?? null
    );
  }

  private referenceText(analyte: AnalyteDefinition, patient: PatientEntity | null): string | null {
    if (analyte.resultType !== 'NUMERIC' && analyte.resultType !== 'CALCULATED') return null;
    const range = patient
      ? this.pickRange(analyte.referenceRanges, patient)
      : (analyte.referenceRanges[0] ?? null);
    if (!range || (range.low === null && range.high === null)) return null;
    return `${range.low ?? '—'}–${range.high ?? '—'}${analyte.unit ? ` ${analyte.unit}` : ''}`;
  }

  private complete(definition: TestDefinition, values: ResultValue[]): boolean {
    return definition.analytes.every((analyte) => {
      if (!analyte.required) return true;
      const value = values.find((item) => item.analyteKey === analyte.key);
      return value !== undefined && value.value !== null && value.value !== '';
    });
  }

  private deltaMap(current: ResultValue[], previous: ResultValue[]): Record<string, number> {
    const map: Record<string, number> = {};
    for (const value of current) {
      if (typeof value.value !== 'number') continue;
      const prior = previous.find((item) => item.analyteKey === value.analyteKey);
      if (prior && typeof prior.value === 'number') {
        map[value.analyteKey] = Math.abs(value.value - prior.value);
      }
    }
    return map;
  }

  private valueMap(values: ResultValue[]): Record<string, unknown> {
    return Object.fromEntries(
      values.map((value) => [
        value.analyteKey,
        { value: value.value, flag: value.flag, critical: value.critical },
      ]),
    );
  }

  private async previousResult(
    patientId: Types.ObjectId,
    testCode: string,
    currentId: Types.ObjectId,
    session: ClientSession,
  ): Promise<ResultSetEntity | null> {
    return this.resultModel
      .findOne({
        patientId,
        testCode,
        _id: { $ne: currentId },
        status: { $in: ['VERIFIED', 'RELEASED'] },
      })
      .sort({ createdAt: -1 })
      .session(session)
      .exec();
  }

  private async addReflexRequest(
    caseDoc: CaseEntity,
    discipline: Discipline,
    testCode: string,
    actor: AuthenticatedUser,
    session: ClientSession,
  ): Promise<void> {
    const exists = await this.requestModel
      .findOne({ caseId: caseDoc._id, discipline, code: testCode.toUpperCase() })
      .session(session)
      .exec();
    if (exists) return;
    await this.requestModel.create(
      [
        {
          caseId: caseDoc._id,
          accessionNumber: caseDoc.accessionNumber,
          discipline,
          code: testCode.toUpperCase(),
          name: `${testCode.toUpperCase()} reflex test`,
          status: 'RECEIVED',
          priority: caseDoc.priority,
          requestedBy: new Types.ObjectId(actor.id),
          requestedAt: new Date(),
        },
      ],
      { session },
    );
  }

  private async appendVersion(
    result: ResultSetEntity,
    action: string,
    values: ResultValue[],
    comment: string | null,
    actor: AuthenticatedUser,
    session?: ClientSession,
  ): Promise<void> {
    await new this.versionModel({
      resultSetId: result._id,
      caseId: result.caseId,
      version: result.currentVersion,
      action,
      values,
      comment,
      createdBy: new Types.ObjectId(actor.id),
    }).save({ session });
  }

  private async toResult(result: ResultSetEntity): Promise<ResultSet> {
    const [caseDoc, patient, enteredBy, verifiedBy] = await Promise.all([
      this.caseModel.findById(result.caseId).exec(),
      this.patientModel.findById(result.patientId).exec(),
      result.enteredBy ? this.userModel.findById(result.enteredBy).exec() : null,
      result.verifiedBy ? this.userModel.findById(result.verifiedBy).exec() : null,
    ]);
    return {
      id: result._id.toString(),
      caseId: result.caseId.toString(),
      accessionNumber: caseDoc?.accessionNumber ?? '—',
      patientId: result.patientId.toString(),
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : '—',
      testRequestId: result.testRequestId.toString(),
      discipline: result.discipline,
      testCode: result.testCode,
      testName: result.testName,
      status: result.status,
      currentVersion: result.currentVersion,
      values: result.values,
      comment: result.comment,
      critical: result.critical,
      criticalAcknowledgedAt: result.criticalAcknowledgedAt?.toISOString() ?? null,
      criticalAcknowledgedBy: result.criticalAcknowledgedBy?.toString() ?? null,
      enteredBy: enteredBy ? toUserSummary(enteredBy) : null,
      verifiedBy: verifiedBy ? toUserSummary(verifiedBy) : null,
      verifiedAt: result.verifiedAt?.toISOString() ?? null,
      releasedAt: result.releasedAt?.toISOString() ?? null,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private async toVersion(version: ResultVersionEntity): Promise<ResultVersion> {
    const createdBy = version.createdBy
      ? await this.userModel.findById(version.createdBy).exec()
      : null;
    return {
      id: version._id.toString(),
      resultSetId: version.resultSetId.toString(),
      version: version.version,
      action: version.action as ResultVersion['action'],
      values: version.values,
      comment: version.comment,
      createdBy: createdBy ? toUserSummary(createdBy) : null,
      createdAt: version.createdAt.toISOString(),
    };
  }

  private assertAccess(user: AuthenticatedUser, discipline: Discipline): void {
    if (user.role === 'SUPER_ADMIN' || user.role === 'LAB_ADMIN') return;
    const assigned = this.clinicalDisciplines(user);
    if (assigned.length > 0 && !assigned.includes(discipline)) {
      throw new ForbiddenException('You are not assigned to this discipline.');
    }
  }

  private clinicalDisciplines(user: AuthenticatedUser): Discipline[] {
    if (user.role === 'SUPER_ADMIN' || user.role === 'LAB_ADMIN') return [];
    if (user.role === 'PATHOLOGIST' || user.role === 'SCIENTIST' || user.role === 'TECHNOLOGIST') {
      return user.disciplines.length > 0 ? user.disciplines : ['HISTOPATHOLOGY'];
    }
    return [];
  }
}
