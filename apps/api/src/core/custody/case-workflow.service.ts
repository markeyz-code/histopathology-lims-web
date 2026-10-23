import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession } from 'mongoose';
import { CASE_STATUS_RANK, canCaseTransition, type CaseStatus } from '@lims/shared';
import type { Actor } from '../../common/utils/actor';
import { AuditService } from '../audit/audit.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { CustodyService } from './custody.service';
import { TestRequestsService } from '../test-requests/test-requests.service';

@Injectable()
export class CaseWorkflowService {
  constructor(
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    private readonly custody: CustodyService,
    private readonly audit: AuditService,
    private readonly testRequests: TestRequestsService,
  ) {}

  /**
   * Move a case forward during the physical workflow. A scan never fails because
   * the case is already ahead; it simply does not regress the case status.
   */
  async advance(
    caseId: Types.ObjectId,
    target: 'IN_PROGRESS' | 'PENDING_REVIEW',
    actor: Actor,
    session: ClientSession,
    trigger: string,
  ): Promise<CaseEntity> {
    const caseDoc = await this.caseModel.findById(caseId).session(session).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    if (CASE_STATUS_RANK[caseDoc.status] >= CASE_STATUS_RANK[target]) return caseDoc;
    if (!canCaseTransition(caseDoc.status, target)) return caseDoc;
    return this.applyStatus(caseDoc, target, actor, session, trigger, {});
  }

  async signOut(caseId: Types.ObjectId, actor: Actor, session: ClientSession): Promise<CaseEntity> {
    const caseDoc = await this.caseModel.findById(caseId).session(session).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    if (caseDoc.status === 'REPORTED' || caseDoc.status === 'AMENDED') {
      throw new ConflictException('This case has already been reported.');
    }
    if (!canCaseTransition(caseDoc.status, 'REPORTED')) {
      throw new ConflictException(
        `A case in ${caseDoc.status.replace('_', ' ').toLowerCase()} cannot be reported yet.`,
      );
    }
    return this.applyStatus(caseDoc, 'REPORTED', actor, session, 'Report signed out', {
      reportedAt: new Date(),
      reportedBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
    });
  }

  async amend(
    caseId: Types.ObjectId,
    actor: Actor,
    session: ClientSession,
    reason: string,
  ): Promise<CaseEntity> {
    const caseDoc = await this.caseModel.findById(caseId).session(session).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    if (caseDoc.status !== 'REPORTED' && caseDoc.status !== 'AMENDED') {
      throw new ConflictException('Only a reported case can be amended.');
    }
    if (caseDoc.status === 'AMENDED') {
      caseDoc.amendedAt = new Date();
      await caseDoc.save({ session });
      await this.testRequests.updateStatusForCase(caseDoc._id, caseDoc.status, session);
      await this.audit.record(
        {
          action: 'AMEND',
          entityType: 'Case',
          entityId: caseDoc._id.toString(),
          caseId: caseDoc._id.toString(),
          before: { status: caseDoc.status },
          after: { status: caseDoc.status },
          metadata: { reason, repeatAmendment: true },
        },
        session,
      );
      return caseDoc;
    }
    return this.applyStatus(caseDoc, 'AMENDED', actor, session, 'Report amended', {
      amendedAt: new Date(),
      amendmentReason: reason,
    });
  }

  private async applyStatus(
    caseDoc: CaseEntity & { save: (options?: { session?: ClientSession }) => Promise<unknown> },
    target: CaseStatus,
    actor: Actor,
    session: ClientSession,
    trigger: string,
    extra: {
      reportedAt?: Date;
      reportedBy?: Types.ObjectId | null;
      amendedAt?: Date;
      amendmentReason?: string;
    },
  ): Promise<CaseEntity> {
    const from = caseDoc.status;
    caseDoc.status = target;
    caseDoc.statusChangedAt = new Date();
    if (extra.reportedAt) caseDoc.reportedAt = extra.reportedAt;
    if (extra.reportedBy !== undefined) caseDoc.reportedBy = extra.reportedBy;
    if (extra.amendedAt) caseDoc.amendedAt = extra.amendedAt;
    await caseDoc.save({ session });
    await this.testRequests.updateStatusForCase(caseDoc._id, target, session);

    await this.custody.append(
      {
        entityType: 'CASE',
        entityId: caseDoc._id,
        caseId: caseDoc._id,
        eventType: target,
        station: null,
        fromState: from,
        toState: target,
        reason: extra.amendmentReason ?? trigger,
        metadata: { trigger },
      },
      actor,
      session,
    );

    await this.audit.record(
      {
        action: target === 'AMENDED' ? 'AMEND' : target === 'REPORTED' ? 'SIGN_OUT' : 'UPDATE',
        entityType: 'Case',
        entityId: caseDoc._id.toString(),
        caseId: caseDoc._id.toString(),
        before: { status: from },
        after: { status: target },
        metadata: { trigger, ...(extra.amendmentReason ? { reason: extra.amendmentReason } : {}) },
      },
      session,
    );

    return caseDoc;
  }
}
