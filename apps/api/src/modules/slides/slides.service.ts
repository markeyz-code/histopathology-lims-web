import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import { checkTransition, slideLabel, type Paginated, type Slide } from '@lims/shared';
import { currentActor } from '../../common/utils/actor';
import { buildPaginated } from '../../common/utils/format';
import { makeBarcode } from '../../common/utils/crypto';
import { withTransaction } from '../../common/utils/transaction';
import { toBlock, toSlide } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { BlockModelName, type BlockEntity } from '../blocks/block.schema';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { CaseWorkflowService } from '../custody/case-workflow.service';
import { CustodyService } from '../custody/custody.service';
import { SlideModelName, type SlideEntity } from './slide.schema';
import type {
  CutSlidesDto,
  RecutRequestDto,
  SlideListQueryDto,
  StainRequestDto,
} from './dto/slide.dto';

@Injectable()
export class SlidesService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(SlideModelName) private readonly slideModel: Model<SlideEntity>,
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    private readonly custody: CustodyService,
    private readonly workflow: CaseWorkflowService,
    private readonly audit: AuditService,
  ) {}

  async list(query: SlideListQueryDto): Promise<Paginated<Slide>> {
    const filter: Record<string, unknown> = {};
    if (query.caseId) filter.caseId = new Types.ObjectId(query.caseId);
    if (query.blockId) filter.blockId = new Types.ObjectId(query.blockId);
    const [slides, total] = await Promise.all([
      this.slideModel
        .find(filter)
        .sort({ blockLabel: 1, slideNumber: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.slideModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(slides.map(toSlide), total, query.page, query.limit);
  }

  async cut(dto: CutSlidesDto): Promise<Slide[]> {
    const actor = currentActor();
    const stainType = dto.stainType ?? 'H_AND_E';
    if (stainType !== 'H_AND_E' && !dto.specialStain?.trim()) {
      throw new BadRequestException('Name the special stain or antibody.');
    }

    return withTransaction(this.connection, async (session) => {
      const block = await this.blockModel.findById(dto.blockId).session(session).exec();
      if (!block) throw new NotFoundException('Block not found.');
      if (block.status !== 'EMBEDDED' && block.status !== 'CUT') {
        throw new ConflictException(
          'The block must be embedded before slides can be cut. Scan it through processing and embedding first.',
        );
      }
      const caseDoc = await this.caseModel.findById(block.caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');

      const now = new Date();
      if (block.status === 'EMBEDDED') {
        const before = toBlock(block);
        block.status = 'CUT';
        block.currentStation = 'MICROTOMY';
        block.lastEventAt = now;
        await block.save({ session });
        await this.custody.append(
          {
            entityType: 'BLOCK',
            entityId: block._id,
            caseId: block.caseId,
            eventType: 'CUT',
            station: 'MICROTOMY',
            fromState: 'EMBEDDED',
            toState: 'CUT',
            reason: 'Sections cut',
            barcode: block.barcode,
            metadata: { label: block.label, slidesCut: dto.count },
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
            caseId: block.caseId.toString(),
            before,
            after: toBlock(block),
          },
          session,
        );
      }

      const existing = await this.slideModel
        .countDocuments({ blockId: block._id, caseId: block.caseId })
        .session(session)
        .exec();

      const created: SlideEntity[] = [];
      for (let index = 0; index < dto.count; index += 1) {
        const slideNumber = existing + index + 1;
        const slide = new this.slideModel({
          caseId: block.caseId,
          specimenId: block.specimenId,
          blockId: block._id,
          blockLabel: block.label,
          slideNumber,
          label: slideLabel(block.label, slideNumber),
          barcode: makeBarcode('SL'),
          stainType,
          specialStain: dto.specialStain?.trim() || null,
          status: 'CUT',
          currentStation: 'MICROTOMY',
          requestReason: null,
          notes: dto.notes?.trim() || null,
          createdBy: new Types.ObjectId(actor.userId ?? ''),
          lastEventAt: now,
        });
        await slide.save({ session });
        created.push(slide);
        await this.custody.append(
          {
            entityType: 'SLIDE',
            entityId: slide._id,
            caseId: slide.caseId,
            eventType: 'CUT',
            station: 'MICROTOMY',
            fromState: 'ACCESSIONED',
            toState: 'CUT',
            reason: 'Slide created at microtomy',
            barcode: slide.barcode,
            metadata: { label: slide.label, stainType: slide.stainType },
            timestamp: now,
          },
          actor,
          session,
        );
        await this.audit.record(
          {
            action: 'CREATE',
            entityType: 'Slide',
            entityId: slide._id.toString(),
            caseId: slide.caseId.toString(),
            after: toSlide(slide),
          },
          session,
        );
      }

      block.slideCount += created.length;
      await block.save({ session });

      await this.caseModel
        .updateOne(
          { _id: caseDoc._id },
          { $inc: { 'summary.slideCount': created.length } },
          { session },
        )
        .exec();

      await this.workflow.advance(caseDoc._id, 'IN_PROGRESS', actor, session, 'Slides cut');

      return created.map(toSlide);
    });
  }

  async requestStain(dto: StainRequestDto): Promise<Slide> {
    const actor = currentActor();
    return withTransaction(this.connection, async (session) => {
      const block = await this.blockModel.findById(dto.blockId).session(session).exec();
      if (!block) throw new NotFoundException('Block not found.');
      if (block.status === 'REJECTED' || block.status === 'ARCHIVED') {
        throw new ConflictException('This block cannot accept a new stain request.');
      }
      const caseDoc = await this.caseModel.findById(block.caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');

      const existing = await this.slideModel
        .countDocuments({ blockId: block._id, caseId: block.caseId })
        .session(session)
        .exec();
      const slideNumber = existing + 1;
      const now = new Date();
      const slide = new this.slideModel({
        caseId: block.caseId,
        specimenId: block.specimenId,
        blockId: block._id,
        blockLabel: block.label,
        slideNumber,
        label: slideLabel(block.label, slideNumber),
        barcode: makeBarcode('SL'),
        stainType: dto.stainType,
        specialStain: dto.specialStain.trim(),
        status: 'ACCESSIONED',
        currentStation: null,
        requestReason: dto.reason.trim(),
        notes: null,
        createdBy: new Types.ObjectId(actor.userId ?? ''),
        lastEventAt: now,
      });
      await slide.save({ session });

      await this.custody.append(
        {
          entityType: 'SLIDE',
          entityId: slide._id,
          caseId: slide.caseId,
          eventType: 'ACCESSIONED',
          station: null,
          fromState: null,
          toState: 'ACCESSIONED',
          reason: dto.reason.trim(),
          barcode: slide.barcode,
          metadata: {
            label: slide.label,
            stainType: slide.stainType,
            specialStain: slide.specialStain,
          },
          timestamp: now,
        },
        actor,
        session,
      );

      block.slideCount += 1;
      await block.save({ session });
      await this.caseModel
        .updateOne({ _id: caseDoc._id }, { $inc: { 'summary.slideCount': 1 } }, { session })
        .exec();

      await this.audit.record(
        {
          action: 'CREATE',
          entityType: 'Slide',
          entityId: slide._id.toString(),
          caseId: slide.caseId.toString(),
          after: toSlide(slide),
          metadata: { specialStainRequest: true, reason: dto.reason },
        },
        session,
      );

      return toSlide(slide);
    });
  }

  async requestRecut(slideId: string, dto: RecutRequestDto): Promise<Slide> {
    const actor = currentActor();
    return withTransaction(this.connection, async (session) => {
      const slide = await this.slideModel.findById(slideId).session(session).exec();
      if (!slide) throw new NotFoundException('Slide not found.');
      const check = checkTransition('SLIDE', slide.status, 'RECUT_REQUESTED');
      if (!check.ok) throw new ConflictException(check.reason ?? 'This slide cannot be recut.');

      const before = toSlide(slide);
      slide.status = 'RECUT_REQUESTED';
      slide.currentStation = 'PATHOLOGIST';
      slide.lastEventAt = new Date();
      await slide.save({ session });

      await this.custody.append(
        {
          entityType: 'SLIDE',
          entityId: slide._id,
          caseId: slide.caseId,
          eventType: 'RECUT_REQUESTED',
          station: 'PATHOLOGIST',
          fromState: before.status,
          toState: 'RECUT_REQUESTED',
          reason: dto.reason,
          barcode: slide.barcode,
          metadata: { label: slide.label },
        },
        actor,
        session,
      );

      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Slide',
          entityId: slide._id.toString(),
          caseId: slide.caseId.toString(),
          before,
          after: toSlide(slide),
          metadata: { reason: dto.reason, recut: true },
        },
        session,
      );

      return toSlide(slide);
    });
  }
}
