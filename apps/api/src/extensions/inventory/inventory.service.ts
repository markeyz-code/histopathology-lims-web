import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession, type Connection, type HydratedDocument } from 'mongoose';
import {
  REAGENT_CATEGORY_LABELS,
  checkTransition,
  type Paginated,
  type ReagentLot,
  type StainRun,
} from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { currentActor } from '../../common/utils/actor';
import { buildPaginated } from '../../common/utils/format';
import { withTransaction } from '../../common/utils/transaction';
import { AuditService } from '../../core/audit/audit.service';
import {
  BlockModelName,
  type BlockEntity,
} from '../../disciplines/histopathology/blocks/block.schema';
import { CaseModelName, type CaseEntity } from '../../core/cases/case.schema';
import { CustodyService } from '../../core/custody/custody.service';
import { LabModelName, type LabEntity } from '../../core/labs/lab.schema';
import { NotificationService } from '../../core/notifications/notification.service';
import {
  SlideModelName,
  type SlideEntity,
} from '../../disciplines/histopathology/slides/slide.schema';
import { UserModelName, type UserEntity } from '../../core/users/user.schema';
import { ReagentLotModelName, type ReagentLotEntity } from './reagent-lot.schema';
import { StainRunModelName, type StainRunEntity } from './stain-run.schema';
import type {
  AdjustLotDto,
  CompleteStainRunDto,
  CreateReagentLotDto,
  CreateStainRunDto,
  ReagentLotQueryDto,
  StainRunQueryDto,
  UpdateReagentLotDto,
  ValidateLotDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ReagentLotModelName) private readonly lotModel: Model<ReagentLotEntity>,
    @InjectModel(StainRunModelName) private readonly runModel: Model<StainRunEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    @InjectModel(SlideModelName) private readonly slideModel: Model<SlideEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    private readonly custody: CustodyService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  async listLots(query: ReagentLotQueryDto): Promise<Paginated<ReagentLot>> {
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;
    if (query.q) {
      const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: regex }, { vendor: regex }, { lotNumber: regex }];
    }
    if (query.expiringWithinDays !== undefined) {
      filter.expiresAt = {
        $gte: new Date(),
        $lte: new Date(Date.now() + query.expiringWithinDays * 86_400_000),
      };
      filter.status = 'ACTIVE';
    }
    const [docs, total] = await Promise.all([
      this.lotModel
        .find(filter)
        .sort({ expiresAt: 1, name: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.lotModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(
      await Promise.all(docs.map((doc) => this.toLot(doc))),
      total,
      query.page,
      query.limit,
    );
  }

  async createLot(dto: CreateReagentLotDto, actor: AuthenticatedUser): Promise<ReagentLot> {
    if (new Date(dto.expiresAt) <= new Date(dto.receivedAt)) {
      throw new ConflictException('Expiry must be after the date the lot was received.');
    }
    if (dto.openedAt && new Date(dto.openedAt) < new Date(dto.receivedAt)) {
      throw new ConflictException('Opened date cannot be before the received date.');
    }
    const existing = await this.lotModel
      .findOne({ lotNumber: dto.lotNumber.trim(), vendor: dto.vendor.trim() })
      .exec();
    if (existing) throw new ConflictException('This vendor lot number is already registered.');

    return withTransaction(this.connection, async (session) => {
      const lot = new this.lotModel({
        name: dto.name.trim(),
        category: dto.category,
        vendor: dto.vendor.trim(),
        catalogNumber: dto.catalogNumber?.trim() || null,
        lotNumber: dto.lotNumber.trim(),
        storageLocation: dto.storageLocation?.trim() || null,
        quantity: dto.quantity,
        initialQuantity: dto.quantity,
        unit: dto.unit.trim(),
        receivedAt: new Date(dto.receivedAt),
        openedAt: dto.openedAt ? new Date(dto.openedAt) : null,
        expiresAt: new Date(dto.expiresAt),
        status: 'QUARANTINED',
        validationStatus: 'PENDING',
        reorderLevel: dto.reorderLevel ?? 0,
        notes: dto.notes?.trim() || null,
        createdBy: new Types.ObjectId(actor.id),
      });
      await lot.save({ session });
      await this.audit.record(
        {
          action: 'CREATE',
          entityType: 'ReagentLot',
          entityId: lot._id.toString(),
          after: this.lotSnapshot(lot),
          metadata: { lotNumber: lot.lotNumber, vendor: lot.vendor },
        },
        session,
      );
      return this.toLot(lot);
    });
  }

  async updateLot(
    id: string,
    dto: UpdateReagentLotDto,
    _actor: AuthenticatedUser,
  ): Promise<ReagentLot> {
    return withTransaction(this.connection, async (session) => {
      const lot = await this.lotModel.findById(id).session(session).exec();
      if (!lot) throw new NotFoundException('Reagent lot not found.');
      const before = this.lotSnapshot(lot);
      if (dto.name !== undefined) lot.name = dto.name.trim();
      if (dto.vendor !== undefined) lot.vendor = dto.vendor.trim();
      if (dto.storageLocation !== undefined)
        lot.storageLocation = dto.storageLocation.trim() || null;
      if (dto.openedAt !== undefined) lot.openedAt = dto.openedAt ? new Date(dto.openedAt) : null;
      if (dto.expiresAt !== undefined) lot.expiresAt = new Date(dto.expiresAt);
      if (dto.quantity !== undefined) {
        lot.quantity = dto.quantity;
        if (lot.quantity <= 0 && lot.status === 'ACTIVE') lot.status = 'DEPLETED';
      }
      if (dto.reorderLevel !== undefined) lot.reorderLevel = dto.reorderLevel;
      if (dto.notes !== undefined) lot.notes = dto.notes.trim() || null;
      await lot.save({ session });
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'ReagentLot',
          entityId: lot._id.toString(),
          before,
          after: this.lotSnapshot(lot),
        },
        session,
      );
      return this.toLot(lot);
    });
  }

  async validateLot(
    id: string,
    dto: ValidateLotDto,
    actor: AuthenticatedUser,
  ): Promise<ReagentLot> {
    return withTransaction(this.connection, async (session) => {
      const lot = await this.lotModel.findById(id).session(session).exec();
      if (!lot) throw new NotFoundException('Reagent lot not found.');
      if (lot.expiresAt <= new Date()) {
        throw new ConflictException('An expired lot cannot be validated.');
      }
      const before = this.lotSnapshot(lot);
      lot.validationStatus = 'VALIDATED';
      lot.validatedAt = new Date();
      lot.validatedBy = new Types.ObjectId(actor.id);
      lot.validationNote = dto.note?.trim() || null;
      lot.status = lot.quantity > 0 ? 'ACTIVE' : 'DEPLETED';
      await lot.save({ session });
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'ReagentLot',
          entityId: lot._id.toString(),
          before,
          after: this.lotSnapshot(lot),
          metadata: { event: 'validated' },
        },
        session,
      );
      return this.toLot(lot);
    });
  }

  async rejectLot(id: string, dto: ValidateLotDto, _actor: AuthenticatedUser): Promise<ReagentLot> {
    return withTransaction(this.connection, async (session) => {
      const lot = await this.lotModel.findById(id).session(session).exec();
      if (!lot) throw new NotFoundException('Reagent lot not found.');
      const before = this.lotSnapshot(lot);
      lot.status = 'REJECTED';
      lot.validationStatus = 'FAILED';
      lot.validationNote = dto.note?.trim() || 'Rejected by laboratory QC.';
      await lot.save({ session });
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'ReagentLot',
          entityId: lot._id.toString(),
          before,
          after: this.lotSnapshot(lot),
          metadata: { event: 'rejected', note: lot.validationNote },
        },
        session,
      );
      return this.toLot(lot);
    });
  }

  async adjustLot(id: string, dto: AdjustLotDto, _actor: AuthenticatedUser): Promise<ReagentLot> {
    return withTransaction(this.connection, async (session) => {
      const lot = await this.lotModel.findById(id).session(session).exec();
      if (!lot) throw new NotFoundException('Reagent lot not found.');
      const next = lot.quantity + dto.delta;
      if (next < 0) throw new ConflictException('Stock cannot fall below zero.');
      const before = this.lotSnapshot(lot);
      lot.quantity = next;
      if (next === 0 && lot.status === 'ACTIVE') lot.status = 'DEPLETED';
      if (next > 0 && lot.status === 'DEPLETED') lot.status = 'ACTIVE';
      await lot.save({ session });
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'ReagentLot',
          entityId: lot._id.toString(),
          before,
          after: this.lotSnapshot(lot),
          metadata: { event: 'stock-adjustment', delta: dto.delta, note: dto.note },
        },
        session,
      );
      return this.toLot(lot);
    });
  }

  async listRuns(query: StainRunQueryDto): Promise<Paginated<StainRun>> {
    const filter: Record<string, unknown> = {};
    if (query.caseId) filter.caseId = new Types.ObjectId(query.caseId);
    if (query.status) filter.status = query.status;
    const [docs, total] = await Promise.all([
      this.runModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.runModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(
      await Promise.all(docs.map((doc) => this.toRun(doc))),
      total,
      query.page,
      query.limit,
    );
  }

  async createRun(dto: CreateStainRunDto, actor: AuthenticatedUser): Promise<StainRun> {
    return withTransaction(this.connection, async (session) => {
      const caseDoc = await this.caseModel.findById(dto.caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');
      if (dto.slideId) {
        const slide = await this.slideModel
          .findOne({ _id: dto.slideId, caseId: caseDoc._id })
          .session(session)
          .exec();
        if (!slide) throw new NotFoundException('Slide not found in this case.');
        if (
          slide.status !== 'CUT' &&
          slide.status !== 'STAINED' &&
          slide.status !== 'RECUT_REQUESTED'
        ) {
          throw new ConflictException('This slide is not waiting for a stain run.');
        }
      }
      if (dto.blockId) {
        const block = await this.blockModel
          .findOne({ _id: dto.blockId, caseId: caseDoc._id })
          .session(session)
          .exec();
        if (!block) throw new NotFoundException('Block not found in this case.');
      }

      const lots = await this.assertUsableLots(dto.lots, session);
      const now = new Date();
      const run = new this.runModel({
        caseId: caseDoc._id,
        slideId: dto.slideId ? new Types.ObjectId(dto.slideId) : null,
        blockId: dto.blockId ? new Types.ObjectId(dto.blockId) : null,
        stainType: dto.stainType,
        stainName: dto.stainName.trim(),
        status: 'RUNNING',
        qcResult: 'PENDING',
        lots: lots.map(({ lot, quantityUsed }) => ({
          lotId: lot._id,
          lotNumber: lot.lotNumber,
          name: lot.name,
          quantityUsed,
        })),
        equipment: dto.equipment?.trim() || null,
        operatorId: new Types.ObjectId(actor.id),
        startedAt: now,
        notes: dto.notes?.trim() || null,
        createdBy: new Types.ObjectId(actor.id),
      });
      await run.save({ session });

      for (const { lot, quantityUsed } of lots) {
        const next = lot.quantity - quantityUsed;
        lot.quantity = next;
        if (next <= 0) lot.status = 'DEPLETED';
        await lot.save({ session });
        await this.audit.record(
          {
            action: 'UPDATE',
            entityType: 'ReagentLot',
            entityId: lot._id.toString(),
            before: { quantity: lot.quantity + quantityUsed, status: lot.status },
            after: { quantity: lot.quantity, status: lot.status },
            metadata: { event: 'stain-run-consumption', stainRunId: run._id.toString() },
          },
          session,
        );
      }

      if (dto.slideId) {
        await this.slideModel
          .updateOne({ _id: dto.slideId }, { $set: { stainRunId: run._id } }, { session })
          .exec();
      }

      await this.audit.record(
        {
          action: 'CREATE',
          entityType: 'StainRun',
          entityId: run._id.toString(),
          caseId: caseDoc._id.toString(),
          after: this.runSnapshot(run),
          metadata: { stainName: run.stainName, lots: lots.length },
        },
        session,
      );
      return this.toRun(run);
    });
  }

  async completeRun(
    id: string,
    dto: CompleteStainRunDto,
    actor: AuthenticatedUser,
  ): Promise<StainRun> {
    return withTransaction(this.connection, async (session) => {
      const run = await this.runModel.findById(id).session(session).exec();
      if (!run) throw new NotFoundException('Stain run not found.');
      if (run.status === 'COMPLETED') throw new ConflictException('This run is already complete.');
      const caseDoc = await this.caseModel.findById(run.caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');

      const before = this.runSnapshot(run);
      run.status =
        dto.qcResult === 'FAIL' ? 'FAILED' : dto.qcResult === 'PENDING' ? 'QC_HOLD' : 'COMPLETED';
      run.qcResult = dto.qcResult;
      run.completedAt = new Date();
      if (dto.notes !== undefined) run.notes = dto.notes.trim() || null;
      await run.save({ session });

      if (dto.qcResult === 'PASS' && run.slideId) {
        const slide = await this.slideModel.findById(run.slideId).session(session).exec();
        if (slide) {
          const check = checkTransition('SLIDE', slide.status, 'STAINED');
          if (check.ok) {
            const from = slide.status;
            slide.status = 'STAINED';
            slide.currentStation = 'STAINING';
            slide.lastEventAt = new Date();
            await slide.save({ session });
            await this.custody.append(
              {
                entityType: 'SLIDE',
                entityId: slide._id,
                caseId: slide.caseId,
                eventType: 'STAINED',
                station: 'STAINING',
                fromState: from,
                toState: 'STAINED',
                reason: `Stain run ${run.stainName} passed QC`,
                barcode: slide.barcode,
                metadata: {
                  label: slide.label,
                  stainRunId: run._id.toString(),
                  stainName: run.stainName,
                },
                timestamp: new Date(),
              },
              this.toActor(actor),
              session,
            );
          }
        }
      }

      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'StainRun',
          entityId: run._id.toString(),
          caseId: run.caseId.toString(),
          before,
          after: this.runSnapshot(run),
          metadata: { qcResult: run.qcResult },
        },
        session,
      );
      return this.toRun(run);
    });
  }

  async checkExpiries(): Promise<number> {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 86_400_000);
    const lots = await this.lotModel
      .find({
        status: { $in: ['ACTIVE', 'QUARANTINED'] },
        expiresAt: { $lte: soon },
      })
      .limit(500)
      .exec();
    let expired = 0;
    for (const lot of lots) {
      if (lot.expiresAt <= now && lot.status !== 'EXPIRED') {
        lot.status = 'EXPIRED';
        lot.expiryAlertedAt = now;
        await lot.save();
        expired += 1;
        await this.notifications.send({
          labId: lot.labId.toString(),
          type: 'LOT_EXPIRED',
          title: `Lot expired — ${lot.name}`,
          body: `${lot.name} (lot ${lot.lotNumber}) expired on ${lot.expiresAt.toISOString().slice(0, 10)}. Remove it from active use.`,
          role: 'LAB_ADMIN',
          entityType: 'ReagentLot',
          entityId: lot._id.toString(),
          metadata: { lotNumber: lot.lotNumber, vendor: lot.vendor },
        });
      } else if (
        lot.status === 'ACTIVE' &&
        lot.expiresAt > now &&
        (!lot.expiryAlertedAt || now.getTime() - lot.expiryAlertedAt.getTime() > 7 * 86_400_000)
      ) {
        lot.expiryAlertedAt = now;
        await lot.save();
        const days = Math.ceil((lot.expiresAt.getTime() - now.getTime()) / 86_400_000);
        await this.notifications.send({
          labId: lot.labId.toString(),
          type: 'LOT_EXPIRING',
          title: `Lot expiring in ${days} days — ${lot.name}`,
          body: `${lot.name} (lot ${lot.lotNumber}) expires on ${lot.expiresAt.toISOString().slice(0, 10)}. Plan a replacement before it leaves the validated window.`,
          role: 'LAB_ADMIN',
          entityType: 'ReagentLot',
          entityId: lot._id.toString(),
          metadata: { lotNumber: lot.lotNumber, days },
        });
      }
    }
    if (expired > 0) this.logger.warn(`Marked ${expired} reagent lots expired.`);
    return expired;
  }

  async runExpiryChecks(): Promise<number> {
    const labs = await this.labModel.find({ active: true }).select('_id').exec();
    let total = 0;
    for (const lab of labs) {
      total += await this.runInTenant(lab._id.toString(), () => this.checkExpiries());
    }
    return total;
  }

  private async runInTenant<T>(labId: string, fn: () => Promise<T>): Promise<T> {
    const { runWithTenant } = await import('../../common/context/tenant-context');
    return runWithTenant({ labId }, fn);
  }

  private async assertUsableLots(
    selections: Array<{ lotId: string; quantityUsed: number }>,
    session: ClientSession,
  ): Promise<Array<{ lot: HydratedDocument<ReagentLotEntity>; quantityUsed: number }>> {
    const results: Array<{ lot: HydratedDocument<ReagentLotEntity>; quantityUsed: number }> = [];
    for (const selection of selections) {
      const lot = await this.lotModel.findById(selection.lotId).session(session).exec();
      if (!lot) throw new NotFoundException('Reagent lot not found.');
      if (lot.status !== 'ACTIVE' || lot.validationStatus !== 'VALIDATED') {
        throw new ConflictException(
          `${lot.name} (lot ${lot.lotNumber}) is not validated and active. Expired or unvalidated lots cannot be used.`,
        );
      }
      if (lot.expiresAt <= new Date()) {
        throw new ConflictException(`${lot.name} (lot ${lot.lotNumber}) has expired.`);
      }
      if (lot.quantity < selection.quantityUsed) {
        throw new ConflictException(
          `${lot.name} has only ${lot.quantity} ${lot.unit} left; ${selection.quantityUsed} requested.`,
        );
      }
      results.push({ lot, quantityUsed: selection.quantityUsed });
    }
    return results;
  }

  private async toLot(doc: ReagentLotEntity): Promise<ReagentLot> {
    let validatedBy = null;
    if (doc.validatedBy) {
      const user = await this.userModel.findById(doc.validatedBy).exec();
      if (user)
        validatedBy = {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          subspecialties: user.subspecialties,
          disciplines: user.disciplines ?? [],
        };
    }
    return {
      id: doc._id.toString(),
      name: doc.name,
      category: doc.category,
      vendor: doc.vendor,
      catalogNumber: doc.catalogNumber,
      lotNumber: doc.lotNumber,
      storageLocation: doc.storageLocation,
      quantity: doc.quantity,
      initialQuantity: doc.initialQuantity,
      unit: doc.unit,
      receivedAt: doc.receivedAt.toISOString(),
      openedAt: doc.openedAt ? doc.openedAt.toISOString() : null,
      expiresAt: doc.expiresAt.toISOString(),
      status: doc.status,
      validationStatus: doc.validationStatus,
      validatedAt: doc.validatedAt ? doc.validatedAt.toISOString() : null,
      validatedBy,
      notes: doc.notes,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  private async toRun(doc: StainRunEntity): Promise<StainRun> {
    const [operator, caseDoc, slide] = await Promise.all([
      doc.operatorId ? this.userModel.findById(doc.operatorId).exec() : null,
      this.caseModel.findById(doc.caseId).select('accessionNumber').exec(),
      doc.slideId ? this.slideModel.findById(doc.slideId).select('label').exec() : null,
    ]);
    return {
      id: doc._id.toString(),
      caseId: doc.caseId.toString(),
      accessionNumber: caseDoc?.accessionNumber ?? '—',
      slideLabel: slide?.label ?? null,
      slideId: doc.slideId ? doc.slideId.toString() : null,
      blockId: doc.blockId ? doc.blockId.toString() : null,
      stainType: doc.stainType,
      stainName: doc.stainName,
      status: doc.status,
      qcResult: doc.qcResult,
      lots: doc.lots.map((lot) => ({
        lotId: lot.lotId.toString(),
        lotNumber: lot.lotNumber,
        name: lot.name,
        quantityUsed: lot.quantityUsed,
      })),
      equipment: doc.equipment,
      operator: operator
        ? {
            id: operator._id.toString(),
            name: operator.name,
            email: operator.email,
            role: operator.role,
            subspecialties: operator.subspecialties,
            disciplines: operator.disciplines ?? [],
          }
        : null,
      startedAt: doc.startedAt ? doc.startedAt.toISOString() : null,
      completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
      notes: doc.notes,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  private lotSnapshot(lot: ReagentLotEntity) {
    return {
      name: lot.name,
      lotNumber: lot.lotNumber,
      status: lot.status,
      validationStatus: lot.validationStatus,
      quantity: lot.quantity,
      expiresAt: lot.expiresAt.toISOString(),
    };
  }

  private runSnapshot(run: StainRunEntity) {
    return {
      stainName: run.stainName,
      status: run.status,
      qcResult: run.qcResult,
      lots: run.lots.map((lot) => lot.lotNumber),
    };
  }

  private toActor(actor: AuthenticatedUser) {
    return { userId: actor.id, userName: actor.name, userRole: actor.role };
  }
}

void currentActor;
void REAGENT_CATEGORY_LABELS;
void ConfigService;
