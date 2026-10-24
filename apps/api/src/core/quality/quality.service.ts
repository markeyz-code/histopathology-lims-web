import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  capaSchema,
  equipmentSchema,
  nonConformanceSchema,
  nonConformanceUpdateSchema,
  sendOutSchema,
  sendOutUpdateSchema,
  temperatureLogSchema,
  type CapaAction,
  type Equipment,
  type NonConformance,
  type SendOut,
  type TemperatureLog,
} from '@lims/shared';
import { makeBarcode } from '../../common/utils/crypto';
import type { Actor } from '../../common/utils/actor';
import { AuditService } from '../audit/audit.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { TestRequestsService } from '../test-requests/test-requests.service';
import { TestRequestModelName, type TestRequestEntity } from '../test-requests/test-request.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';
import {
  CapaActionModelName,
  EquipmentModelName,
  NonConformanceModelName,
  SendOutModelName,
  TemperatureLogModelName,
  type CapaActionEntity,
  type EquipmentEntity,
  type NonConformanceEntity,
  type SendOutEntity,
  type TemperatureLogEntity,
} from './quality.schema';

@Injectable()
export class QualityService {
  constructor(
    @InjectModel(EquipmentModelName) private readonly equipmentModel: Model<EquipmentEntity>,
    @InjectModel(TemperatureLogModelName)
    private readonly temperatureModel: Model<TemperatureLogEntity>,
    @InjectModel(NonConformanceModelName) private readonly ncModel: Model<NonConformanceEntity>,
    @InjectModel(CapaActionModelName) private readonly capaModel: Model<CapaActionEntity>,
    @InjectModel(SendOutModelName) private readonly sendOutModel: Model<SendOutEntity>,
    @InjectModel(TestRequestModelName) private readonly requestModel: Model<TestRequestEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    private readonly testRequests: TestRequestsService,
    private readonly audit: AuditService,
  ) {}

  async equipment(): Promise<Equipment[]> {
    const rows = await this.equipmentModel.find({}).sort({ name: 1 }).exec();
    return rows.map((row) => this.toEquipment(row));
  }

  async createEquipment(body: unknown, actor: Actor): Promise<Equipment> {
    const parsed = equipmentSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const row = await this.equipmentModel.create({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      serialNumber: parsed.data.serialNumber ?? null,
      location: parsed.data.location ?? null,
      lastCalibrationAt: parsed.data.lastCalibrationAt
        ? new Date(parsed.data.lastCalibrationAt)
        : null,
      nextCalibrationAt: parsed.data.nextCalibrationAt
        ? new Date(parsed.data.nextCalibrationAt)
        : null,
      status: parsed.data.status ?? 'ACTIVE',
      active: parsed.data.active ?? true,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'Equipment',
      entityId: row._id.toString(),
      after: this.toEquipment(row),
      metadata: { actor: actor.userName },
    });
    return this.toEquipment(row);
  }

  async temperatureLogs(equipmentId?: string): Promise<TemperatureLog[]> {
    const filter: Record<string, unknown> = {};
    if (equipmentId) filter.equipmentId = new Types.ObjectId(equipmentId);
    const rows = await this.temperatureModel.find(filter).sort({ createdAt: -1 }).limit(100).exec();
    return Promise.all(rows.map((row) => this.toTemperature(row)));
  }

  async recordTemperature(
    equipmentId: string,
    body: unknown,
    actor: Actor,
  ): Promise<TemperatureLog> {
    const parsed = temperatureLogSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const equipment = await this.equipmentModel.findById(equipmentId).exec();
    if (!equipment) throw new NotFoundException('Equipment not found.');
    const min = parsed.data.minAllowed ?? null;
    const max = parsed.data.maxAllowed ?? null;
    const inRange =
      (min === null || parsed.data.temperature >= min) &&
      (max === null || parsed.data.temperature <= max);
    const row = await this.temperatureModel.create({
      equipmentId: equipment._id,
      temperature: parsed.data.temperature,
      unit: parsed.data.unit,
      minAllowed: min,
      maxAllowed: max,
      inRange,
      recordedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      notes: parsed.data.notes ?? null,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'TemperatureLog',
      entityId: row._id.toString(),
      after: { equipment: equipment.code, temperature: row.temperature, inRange },
      metadata: { actor: actor.userName },
    });
    return this.toTemperature(row);
  }

  async nonConformances(): Promise<NonConformance[]> {
    const rows = await this.ncModel.find({}).sort({ createdAt: -1 }).limit(100).exec();
    return Promise.all(rows.map((row) => this.toNonConformance(row)));
  }

  async createNonConformance(body: unknown, actor: Actor): Promise<NonConformance> {
    const parsed = nonConformanceSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const row = await this.ncModel.create({
      code: makeBarcode('NC'),
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      severity: parsed.data.severity,
      status: 'OPEN',
      reportedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
      assignedTo: parsed.data.assignedToId ? new Types.ObjectId(parsed.data.assignedToId) : null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      rootCause: null,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'NonConformance',
      entityId: row._id.toString(),
      after: this.toNonConformance(row),
      metadata: { actor: actor.userName, severity: row.severity },
    });
    return this.toNonConformance(row);
  }

  async updateNonConformance(id: string, body: unknown, actor: Actor): Promise<NonConformance> {
    const parsed = nonConformanceUpdateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const row = await this.ncModel.findById(id).exec();
    if (!row) throw new NotFoundException('Non-conformance not found.');
    const before = { status: row.status, severity: row.severity, rootCause: row.rootCause };
    if (parsed.data.status) row.status = parsed.data.status;
    if (parsed.data.severity) row.severity = parsed.data.severity;
    if (parsed.data.rootCause !== undefined) row.rootCause = parsed.data.rootCause ?? null;
    if (parsed.data.assignedToId !== undefined)
      row.assignedTo = parsed.data.assignedToId
        ? new Types.ObjectId(parsed.data.assignedToId)
        : null;
    await row.save();
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'NonConformance',
      entityId: row._id.toString(),
      before,
      after: { status: row.status, severity: row.severity, rootCause: row.rootCause },
      metadata: { actor: actor.userName },
    });
    return this.toNonConformance(row);
  }

  async addCapa(nonConformanceId: string, body: unknown, actor: Actor): Promise<CapaAction> {
    const parsed = capaSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const nc = await this.ncModel.findById(nonConformanceId).exec();
    if (!nc) throw new NotFoundException('Non-conformance not found.');
    const row = await this.capaModel.create({
      nonConformanceId: nc._id,
      action: parsed.data.action,
      owner: parsed.data.owner ?? null,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      status: parsed.data.status ?? 'OPEN',
      completedAt: null,
    });
    if (nc.status === 'OPEN') nc.status = 'CAPA';
    await nc.save();
    await this.audit.record({
      action: 'CREATE',
      entityType: 'CapaAction',
      entityId: row._id.toString(),
      after: { action: row.action, status: row.status },
      metadata: { actor: actor.userName, nonConformance: nc.code },
    });
    return this.toCapa(row);
  }

  async sendOuts(): Promise<SendOut[]> {
    const rows = await this.sendOutModel.find({}).sort({ createdAt: -1 }).limit(100).exec();
    return Promise.all(rows.map((row) => this.toSendOut(row)));
  }

  async createSendOut(body: unknown, actor: Actor): Promise<SendOut> {
    const parsed = sendOutSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const request = await this.requestModel.findById(parsed.data.testRequestId).exec();
    if (!request) throw new NotFoundException('Test request not found.');
    const existing = await this.sendOutModel.findOne({ testRequestId: request._id }).exec();
    if (existing) throw new ConflictException('This test request already has a send-out.');
    const row = await this.sendOutModel.create({
      caseId: request.caseId,
      testRequestId: request._id,
      referenceLab: parsed.data.referenceLab,
      reason: parsed.data.reason ?? null,
      courier: parsed.data.courier ?? null,
      trackingNumber: parsed.data.trackingNumber ?? null,
      status: 'SENT',
      sentAt: new Date(),
      receivedAt: null,
      reportedAt: null,
      resultSummary: null,
      createdBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'SendOut',
      entityId: row._id.toString(),
      caseId: row.caseId.toString(),
      after: { referenceLab: row.referenceLab, status: row.status },
      metadata: { actor: actor.userName },
    });
    return this.toSendOut(row);
  }

  async updateSendOut(id: string, body: unknown, actor: Actor): Promise<SendOut> {
    const parsed = sendOutUpdateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const row = await this.sendOutModel.findById(id).exec();
    if (!row) throw new NotFoundException('Send-out not found.');
    const before = row.status;
    if (parsed.data.status) {
      const allowed: Record<string, string[]> = {
        SENT: ['IN_TRANSIT', 'RECEIVED', 'CANCELLED'],
        IN_TRANSIT: ['RECEIVED', 'CANCELLED'],
        RECEIVED: ['REPORTED'],
        REPORTED: [],
        CANCELLED: [],
      };
      if (!(allowed[row.status] ?? []).includes(parsed.data.status))
        throw new ConflictException(
          `Cannot move send-out from ${row.status} to ${parsed.data.status}.`,
        );
      row.status = parsed.data.status;
      if (row.status === 'RECEIVED') row.receivedAt = new Date();
      if (row.status === 'REPORTED') row.reportedAt = new Date();
    }
    if (parsed.data.resultSummary !== undefined)
      row.resultSummary = parsed.data.resultSummary ?? null;
    await row.save();
    if (row.status === 'REPORTED') await this.testRequests.setStatus(row.testRequestId, 'VERIFIED');
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'SendOut',
      entityId: row._id.toString(),
      caseId: row.caseId.toString(),
      before: { status: before },
      after: { status: row.status },
      metadata: { actor: actor.userName },
    });
    return this.toSendOut(row);
  }

  private async toSendOut(row: SendOutEntity): Promise<SendOut> {
    const [request, caseDoc] = await Promise.all([
      this.requestModel.findById(row.testRequestId).exec(),
      this.caseModel.findById(row.caseId).exec(),
    ]);
    return {
      id: row._id.toString(),
      caseId: row.caseId.toString(),
      accessionNumber: caseDoc?.accessionNumber ?? '—',
      testRequestId: row.testRequestId.toString(),
      testName: request?.name ?? 'Test',
      referenceLab: row.referenceLab,
      reason: row.reason,
      courier: row.courier,
      trackingNumber: row.trackingNumber,
      status: row.status,
      sentAt: row.sentAt?.toISOString() ?? null,
      receivedAt: row.receivedAt?.toISOString() ?? null,
      reportedAt: row.reportedAt?.toISOString() ?? null,
      resultSummary: row.resultSummary,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async toNonConformance(row: NonConformanceEntity): Promise<NonConformance> {
    const [reportedBy, assignedTo, actions] = await Promise.all([
      row.reportedBy ? this.userModel.findById(row.reportedBy).exec() : null,
      row.assignedTo ? this.userModel.findById(row.assignedTo).exec() : null,
      this.capaModel.find({ nonConformanceId: row._id }).sort({ createdAt: 1 }).exec(),
    ]);
    return {
      id: row._id.toString(),
      code: row.code,
      title: row.title,
      description: row.description,
      category: row.category,
      severity: row.severity,
      status: row.status,
      reportedBy: reportedBy
        ? {
            id: reportedBy._id.toString(),
            name: reportedBy.name,
            email: reportedBy.email,
            role: reportedBy.role,
            subspecialties: reportedBy.subspecialties,
            disciplines: reportedBy.disciplines ?? [],
          }
        : null,
      assignedTo: assignedTo
        ? {
            id: assignedTo._id.toString(),
            name: assignedTo.name,
            email: assignedTo.email,
            role: assignedTo.role,
            subspecialties: assignedTo.subspecialties,
            disciplines: assignedTo.disciplines ?? [],
          }
        : null,
      dueAt: row.dueAt?.toISOString() ?? null,
      rootCause: row.rootCause,
      actions: actions.map((action) => this.toCapa(action)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async toTemperature(row: TemperatureLogEntity): Promise<TemperatureLog> {
    const [equipment, user] = await Promise.all([
      this.equipmentModel.findById(row.equipmentId).exec(),
      row.recordedBy ? this.userModel.findById(row.recordedBy).exec() : null,
    ]);
    return {
      id: row._id.toString(),
      equipmentId: row.equipmentId.toString(),
      equipmentName: equipment?.name ?? 'Equipment',
      temperature: row.temperature,
      unit: row.unit,
      minAllowed: row.minAllowed,
      maxAllowed: row.maxAllowed,
      inRange: row.inRange,
      recordedBy: user
        ? {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            subspecialties: user.subspecialties,
            disciplines: user.disciplines ?? [],
          }
        : null,
      recordedAt: row.createdAt.toISOString(),
      notes: row.notes,
    };
  }

  private toCapa(row: CapaActionEntity): CapaAction {
    return {
      id: row._id.toString(),
      action: row.action,
      owner: row.owner,
      dueAt: row.dueAt?.toISOString() ?? null,
      status: row.status,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private toEquipment(row: EquipmentEntity): Equipment {
    return {
      id: row._id.toString(),
      code: row.code,
      name: row.name,
      type: row.type,
      serialNumber: row.serialNumber,
      location: row.location,
      status: row.status,
      lastCalibrationAt: row.lastCalibrationAt?.toISOString() ?? null,
      nextCalibrationAt: row.nextCalibrationAt?.toISOString() ?? null,
      active: row.active,
    };
  }
}
