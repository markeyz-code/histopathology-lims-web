import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, type ClientSession, type Connection } from 'mongoose';
import {
  PHYSICAL_STATE_LABELS,
  STATION_LABELS,
  STATION_ROLES,
  checkTransition,
  inferScanTarget,
  scanNextHint,
  stationTarget,
  type CaseStatus,
  type PhysicalEntityType,
  type PhysicalState,
  type ScanResponse,
} from '@lims/shared';
import type { Actor } from '../../common/utils/actor';
import { currentActor } from '../../common/utils/actor';
import { withTransaction } from '../../common/utils/transaction';
import { AuditService } from '../audit/audit.service';
import { BlockModelName, type BlockEntity } from '../blocks/block.schema';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { SlideModelName, type SlideEntity } from '../slides/slide.schema';
import { SpecimenModelName, type SpecimenEntity } from '../specimens/specimen.schema';
import { BarcodeResolverService, type BarcodeMatch } from './barcode-resolver.service';
import { CaseWorkflowService } from './case-workflow.service';
import { CustodyService } from './custody.service';
import type { ScanDto } from './dto/scan.dto';

const ENTITY_LABELS: Record<PhysicalEntityType, string> = {
  SPECIMEN: 'Specimen',
  BLOCK: 'Block',
  SLIDE: 'Slide',
};

@Injectable()
export class ScanService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    @InjectModel(SlideModelName) private readonly slideModel: Model<SlideEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    private readonly barcodeResolver: BarcodeResolverService,
    private readonly custody: CustodyService,
    private readonly workflow: CaseWorkflowService,
    private readonly audit: AuditService,
  ) {}

  async scan(input: ScanDto): Promise<ScanResponse> {
    const actor = currentActor();
    this.assertStationRole(input.station, actor);
    if (input.eventType && !input.reason?.trim()) {
      throw new BadRequestException('A reason is required for a rejection or recut request.');
    }
    if (input.eventType === 'RECUT_REQUESTED' && input.station !== 'PATHOLOGIST') {
      throw new BadRequestException('Recuts are requested from the pathologist desk.');
    }

    return withTransaction(this.connection, async (session) => {
      const match = await this.barcodeResolver.resolve(input.barcode, session);
      if (!match) {
        throw new NotFoundException(
          `No specimen, block or slide matches barcode ${input.barcode}. Check the label and try again.`,
        );
      }

      const entityType = match.entityType;
      const entity = match.entity;
      const currentState = entity.status;

      let target: PhysicalState;
      if (input.eventType) {
        target = input.eventType;
        if (input.eventType === 'RECUT_REQUESTED' && entityType !== 'SLIDE') {
          throw new BadRequestException('Only slides can be sent for a recut.');
        }
        const check = checkTransition(entityType, currentState, target);
        if (!check.ok) {
          throw new ConflictException(check.reason ?? 'Invalid transition.');
        }
      } else {
        const stationTargetState = stationTarget(entityType, input.station);
        if (!stationTargetState) {
          throw new BadRequestException(
            `A ${ENTITY_LABELS[entityType].toLowerCase()} is not scanned at the ${STATION_LABELS[input.station]} station.`,
          );
        }
        const inferred = inferScanTarget(entityType, input.station, currentState);
        if (!inferred) {
          const check = checkTransition(entityType, currentState, stationTargetState);
          throw new ConflictException(
            check.reason ?? `${entity.label} cannot advance at ${STATION_LABELS[input.station]}.`,
          );
        }
        target = inferred;
      }

      const now = new Date();
      const updated = await this.persistState(
        match,
        target,
        input.station,
        now,
        input.reason,
        session,
      );

      await this.custody.append(
        {
          entityType,
          entityId: updated._id,
          caseId: updated.caseId,
          eventType: target,
          station: input.station,
          fromState: currentState,
          toState: target,
          reason: input.reason ?? null,
          barcode: updated.barcode,
          metadata: {
            label: updated.label,
            ...(input.metadata ?? {}),
          },
          timestamp: now,
        },
        actor,
        session,
      );

      if (target === 'GROSSED') {
        await this.workflow.advance(
          updated.caseId,
          'IN_PROGRESS',
          actor,
          session,
          `Scan at ${STATION_LABELS[input.station]}`,
        );
      } else if (target === 'WITH_PATHOLOGIST') {
        await this.workflow.advance(
          updated.caseId,
          'PENDING_REVIEW',
          actor,
          session,
          `Scan at ${STATION_LABELS[input.station]}`,
        );
      }

      await this.caseModel
        .updateOne({ _id: updated.caseId }, { $set: { lastScannedAt: now } }, { session })
        .exec();

      const caseDoc = await this.caseModel.findById(updated.caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found for this item.');
      const patient = await this.patientModel.findById(caseDoc.patientId).session(session).exec();
      if (!patient) throw new NotFoundException('Patient not found for this case.');

      await this.audit.record(
        {
          action: 'SCAN',
          entityType: ENTITY_LABELS[entityType],
          entityId: updated._id.toString(),
          caseId: caseDoc._id.toString(),
          before: {
            status: currentState,
            currentStation: entity.currentStation,
            label: entity.label,
          },
          after: {
            status: target,
            currentStation: input.station,
            label: updated.label,
            station: input.station,
          },
          metadata: {
            barcode: updated.barcode,
            ...(input.reason ? { reason: input.reason } : {}),
          },
        },
        session,
      );

      const message =
        target === 'REJECTED'
          ? `${updated.label} rejected and held.`
          : target === 'RECUT_REQUESTED'
            ? `${updated.label} sent for recut.`
            : `${updated.label} → ${PHYSICAL_STATE_LABELS[target]}`;

      return {
        entity: {
          entityType,
          id: updated._id.toString(),
          barcode: updated.barcode,
          label: updated.label,
          status: target,
          currentStation: input.station,
          caseId: caseDoc._id.toString(),
          accessionNumber: caseDoc.accessionNumber,
          patientName: `${patient.firstName} ${patient.lastName}`,
          caseStatus: caseDoc.status as CaseStatus,
        },
        transition: {
          from: currentState,
          to: target,
          eventType: target,
          station: input.station,
        },
        message,
        nextHint: scanNextHint(target),
        timestamp: now.toISOString(),
      };
    });
  }

  private assertStationRole(station: ScanDto['station'], actor: Actor): void {
    const allowed = STATION_ROLES[station];
    if (!actor.userRole || !allowed.includes(actor.userRole)) {
      throw new ForbiddenException(
        `Your role cannot scan at the ${STATION_LABELS[station]} station.`,
      );
    }
  }

  private async persistState(
    match: BarcodeMatch,
    target: PhysicalState,
    station: ScanDto['station'],
    now: Date,
    reason: string | undefined,
    session: ClientSession,
  ): Promise<
    (SpecimenEntity | BlockEntity | SlideEntity) & {
      _id: import('mongoose').Types.ObjectId;
      caseId: import('mongoose').Types.ObjectId;
      barcode: string;
      label: string;
      currentStation: ScanDto['station'] | null;
    }
  > {
    const baseFilter = { _id: match.entity._id, status: match.entity.status };
    const update: Record<string, unknown> = { status: target, currentStation: station };

    if (match.entityType === 'BLOCK') {
      update.lastEventAt = now;
      const updated = await this.blockModel
        .findOneAndUpdate(baseFilter, { $set: update }, { new: true, session, runValidators: true })
        .exec();
      if (!updated) throw this.concurrentScanError(match.entity.label);
      return updated;
    }

    if (match.entityType === 'SLIDE') {
      update.lastEventAt = now;
      const updated = await this.slideModel
        .findOneAndUpdate(baseFilter, { $set: update }, { new: true, session, runValidators: true })
        .exec();
      if (!updated) throw this.concurrentScanError(match.entity.label);
      return updated;
    }

    if (target === 'REJECTED') update.rejectionReason = reason ?? null;
    const updated = await this.specimenModel
      .findOneAndUpdate(baseFilter, { $set: update }, { new: true, session, runValidators: true })
      .exec();
    if (!updated) throw this.concurrentScanError(match.entity.label);
    return updated;
  }

  private concurrentScanError(label: string): ConflictException {
    return new ConflictException(
      `${label} was already advanced by another station. Refresh and scan again.`,
    );
  }
}
