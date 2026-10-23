import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import { blockLabel, type Block, type Paginated } from '@lims/shared';
import { currentActor } from '../../common/utils/actor';
import { buildPaginated } from '../../common/utils/format';
import { makeBarcode } from '../../common/utils/crypto';
import { withTransaction } from '../../common/utils/transaction';
import { toBlock, toSpecimen } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { CaseWorkflowService } from '../custody/case-workflow.service';
import { CustodyService } from '../custody/custody.service';
import { SpecimenModelName, type SpecimenEntity } from '../specimens/specimen.schema';
import { BlockModelName, type BlockEntity } from './block.schema';
import type { BlockListQueryDto, GrossBlockDto } from './dto/block.dto';

@Injectable()
export class BlocksService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    private readonly custody: CustodyService,
    private readonly workflow: CaseWorkflowService,
    private readonly audit: AuditService,
  ) {}

  async list(query: BlockListQueryDto): Promise<Paginated<Block>> {
    const filter: Record<string, unknown> = {};
    if (query.caseId) filter.caseId = new Types.ObjectId(query.caseId);
    if (query.specimenId) filter.specimenId = new Types.ObjectId(query.specimenId);
    const [blocks, total] = await Promise.all([
      this.blockModel
        .find(filter)
        .sort({ specimenSequence: 1, blockNumber: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.blockModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(blocks.map(toBlock), total, query.page, query.limit);
  }

  async gross(dto: GrossBlockDto): Promise<Block[]> {
    const actor = currentActor();
    return withTransaction(this.connection, async (session) => {
      const specimen = await this.specimenModel.findById(dto.specimenId).session(session).exec();
      if (!specimen) throw new NotFoundException('Specimen not found.');
      if (specimen.status === 'REJECTED' || specimen.status === 'ARCHIVED') {
        throw new ConflictException('A rejected or archived specimen cannot be grossed.');
      }

      const caseDoc = await this.caseModel.findById(specimen.caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');

      const existingCount = await this.blockModel
        .countDocuments({ specimenId: specimen._id, caseId: caseDoc._id })
        .session(session)
        .exec();

      const now = new Date();
      const created: BlockEntity[] = [];
      for (let index = 0; index < dto.blockCount; index += 1) {
        const blockNumber = existingCount + index + 1;
        const label = blockLabel(specimen.sequence, blockNumber);
        const block = new this.blockModel({
          caseId: caseDoc._id,
          specimenId: specimen._id,
          specimenSequence: specimen.sequence,
          blockNumber,
          label,
          barcode: makeBarcode('BL'),
          grossDescription: dto.blockDescriptions?.[index]?.trim() || dto.grossDescription.trim(),
          status: 'ACCESSIONED',
          currentStation: null,
          slideCount: 0,
          lastEventAt: now,
        });
        await block.save({ session });
        created.push(block);

        await this.custody.append(
          {
            entityType: 'BLOCK',
            entityId: block._id,
            caseId: caseDoc._id,
            eventType: 'ACCESSIONED',
            station: null,
            fromState: null,
            toState: 'ACCESSIONED',
            reason: 'Block created at grossing',
            barcode: block.barcode,
            metadata: { label: block.label, specimenLabel: specimen.label },
            timestamp: now,
          },
          actor,
          session,
        );
        await this.audit.record(
          {
            action: 'CREATE',
            entityType: 'Block',
            entityId: block._id.toString(),
            caseId: caseDoc._id.toString(),
            after: toBlock(block),
            metadata: { grossedFrom: specimen.label },
          },
          session,
        );
      }

      const specimenBefore = toSpecimen(specimen);
      specimen.grossDescription = dto.grossDescription.trim();
      if (specimen.status === 'ACCESSIONED') {
        specimen.status = 'GROSSED';
        specimen.currentStation = 'GROSSING';
        await specimen.save({ session });
        await this.custody.append(
          {
            entityType: 'SPECIMEN',
            entityId: specimen._id,
            caseId: caseDoc._id,
            eventType: 'GROSSED',
            station: 'GROSSING',
            fromState: 'ACCESSIONED',
            toState: 'GROSSED',
            reason: 'Gross examination recorded',
            barcode: specimen.barcode,
            metadata: { label: specimen.label, blocksCreated: dto.blockCount },
            timestamp: now,
          },
          actor,
          session,
        );
      } else {
        await specimen.save({ session });
      }
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Specimen',
          entityId: specimen._id.toString(),
          caseId: caseDoc._id.toString(),
          before: specimenBefore,
          after: toSpecimen(specimen),
          metadata: { blocksCreated: dto.blockCount },
        },
        session,
      );

      await this.caseModel
        .updateOne(
          { _id: caseDoc._id },
          { $inc: { 'summary.blockCount': dto.blockCount } },
          { session },
        )
        .exec();

      await this.workflow.advance(caseDoc._id, 'IN_PROGRESS', actor, session, 'Grossing recorded');

      return created.map(toBlock);
    });
  }
}
