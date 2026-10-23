import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession } from 'mongoose';
import type { Actor } from '../../common/utils/actor';
import { AuditService } from '../audit/audit.service';
import { BlockModelName, type BlockEntity } from '../blocks/block.schema';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { SlideModelName, type SlideEntity } from '../slides/slide.schema';
import { CaseWorkflowService } from './case-workflow.service';
import { CustodyService } from './custody.service';

/**
 * Signing out a report is also a physical custody event: reviewed slides become
 * REPORTED (not silently left on the pathologist desk) and their parent blocks do
 * too, so the archive station has a correct worklist.
 */
@Injectable()
export class ReportPropagationService {
  constructor(
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(SlideModelName) private readonly slideModel: Model<SlideEntity>,
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    private readonly custody: CustodyService,
    private readonly workflow: CaseWorkflowService,
    private readonly audit: AuditService,
  ) {}

  async markReported(
    caseId: Types.ObjectId,
    actor: Actor,
    session: ClientSession,
  ): Promise<CaseEntity> {
    const now = new Date();
    const slides = await this.slideModel
      .find({ caseId, status: 'WITH_PATHOLOGIST' })
      .session(session)
      .exec();

    for (const slide of slides) {
      const before = { status: slide.status, label: slide.label };
      slide.status = 'REPORTED';
      slide.currentStation = 'PATHOLOGIST';
      slide.lastEventAt = now;
      await slide.save({ session });
      await this.custody.append(
        {
          entityType: 'SLIDE',
          entityId: slide._id,
          caseId,
          eventType: 'REPORTED',
          station: 'PATHOLOGIST',
          fromState: 'WITH_PATHOLOGIST',
          toState: 'REPORTED',
          reason: 'Report signed out',
          barcode: slide.barcode,
          metadata: { label: slide.label },
          timestamp: now,
        },
        actor,
        session,
      );
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Slide',
          entityId: slide._id.toString(),
          caseId: caseId.toString(),
          before,
          after: { status: slide.status, label: slide.label },
          metadata: { trigger: 'report-signout' },
        },
        session,
      );
    }

    const blocks = await this.blockModel.find({ caseId, status: 'CUT' }).session(session).exec();

    for (const block of blocks) {
      const before = { status: block.status, label: block.label };
      block.status = 'REPORTED';
      block.currentStation = 'PATHOLOGIST';
      block.lastEventAt = now;
      await block.save({ session });
      await this.custody.append(
        {
          entityType: 'BLOCK',
          entityId: block._id,
          caseId,
          eventType: 'REPORTED',
          station: 'PATHOLOGIST',
          fromState: 'CUT',
          toState: 'REPORTED',
          reason: 'Report signed out',
          barcode: block.barcode,
          metadata: { label: block.label },
          timestamp: now,
        },
        actor,
        session,
      );
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Block',
          entityId: block._id.toString(),
          caseId: caseId.toString(),
          before,
          after: { status: block.status, label: block.label },
          metadata: { trigger: 'report-signout' },
        },
        session,
      );
    }

    return this.workflow.signOut(caseId, actor, session);
  }
}
