import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import { checkTransition, type Paginated, type Specimen } from '@lims/shared';
import { currentActor } from '../../common/utils/actor';
import { buildPaginated } from '../../common/utils/format';
import { withTransaction } from '../../common/utils/transaction';
import { toSpecimen } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { CustodyService } from '../custody/custody.service';
import { SpecimenModelName, type SpecimenEntity } from './specimen.schema';
import type { SpecimenListQueryDto } from './dto/specimen.dto';

@Injectable()
export class SpecimensService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    private readonly custody: CustodyService,
    private readonly audit: AuditService,
  ) {}

  async list(query: SpecimenListQueryDto): Promise<Paginated<Specimen>> {
    const filter: Record<string, unknown> = {};
    if (query.caseId) filter.caseId = new Types.ObjectId(query.caseId);
    const [specimens, total] = await Promise.all([
      this.specimenModel
        .find(filter)
        .sort({ receivedAt: -1, sequence: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.specimenModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(specimens.map(toSpecimen), total, query.page, query.limit);
  }

  async reject(id: string, reason: string, reasonCode = 'OTHER'): Promise<Specimen> {
    const actor = currentActor();
    const specimen = await withTransaction(this.connection, async (session) => {
      const current = await this.specimenModel.findById(id).session(session).exec();
      if (!current) throw new NotFoundException('Specimen not found.');
      const check = checkTransition('SPECIMEN', current.status, 'REJECTED');
      if (!check.ok) throw new ConflictException(check.reason ?? 'Specimen cannot be rejected.');

      const caseDoc = await this.caseModel.findById(current.caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');

      const before = toSpecimen(current);
      current.status = 'REJECTED';
      current.rejectionReason = reason;
      current.rejectionCode = reasonCode;
      await current.save({ session });

      await this.custody.append(
        {
          entityType: 'SPECIMEN',
          entityId: current._id,
          caseId: current.caseId,
          eventType: 'REJECTED',
          station: null,
          fromState: before.status,
          toState: 'REJECTED',
          reason,
          barcode: current.barcode,
          metadata: {
            label: current.label,
            ...(current.rejectionReason ? { rejectionReason: current.rejectionReason } : {}),
          },
        },
        actor,
        session,
      );

      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Specimen',
          entityId: current._id.toString(),
          caseId: caseDoc._id.toString(),
          before,
          after: toSpecimen(current),
          metadata: { reason, reasonCode },
        },
        session,
      );
      return current;
    });
    return toSpecimen(specimen);
  }
}
