import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, type ClientSession, type Connection } from 'mongoose';
import {
  formatAccession,
  formatMrn,
  validateAccessionFormat,
  type Discipline,
  type Lab as LabDto,
} from '@lims/shared';
import { withTransaction } from '../../common/utils/transaction';
import { toLab } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { LabModelName, type LabEntity, type LabLetterhead } from './lab.schema';
import type { LetterheadDto, UpdateLabDto } from './dto/update-lab.dto';

export interface AllocatedAccession {
  accessionNumber: string;
  lab: LabEntity;
}

@Injectable()
export class LabsService {
  constructor(
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    @InjectConnection() private readonly connection: Connection,
    private readonly audit: AuditService,
  ) {}

  async getById(labId: string): Promise<LabDto> {
    const lab = await this.labModel.findById(labId).exec();
    if (!lab) throw new NotFoundException('Laboratory not found.');
    return toLab(lab);
  }

  /**
   * Atomically increments a per-lab counter. Used for accession numbers and
   * medical record numbers so concurrent reception desks cannot collide.
   */
  async nextSequence(labId: string, key: string, session: ClientSession): Promise<number> {
    const path = `accessionCounters.${key}`;
    const increment: Record<string, number> = { [path]: 1 };
    const lab = await this.labModel
      .findOneAndUpdate({ _id: labId }, { $inc: increment }, { new: true, session })
      .exec();
    if (!lab) throw new NotFoundException('Laboratory not found.');
    return lab.accessionCounters.get(key) ?? 1;
  }

  async allocateAccession(
    labId: string,
    session: ClientSession,
    discipline: Discipline = 'HISTOPATHOLOGY',
  ): Promise<AllocatedAccession> {
    const lab = await this.labModel.findById(labId).session(session).exec();
    if (!lab) throw new NotFoundException('Laboratory not found.');
    const enabled = lab.enabledDisciplines ?? ['HISTOPATHOLOGY'];
    if (!enabled.includes(discipline)) {
      throw new BadRequestException(
        `${discipline.replace('_', ' ').toLowerCase()} is not enabled for this laboratory.`,
      );
    }
    const year = new Date().getUTCFullYear();
    const counterKey =
      discipline === 'HISTOPATHOLOGY' ? String(year) : `${discipline.toLowerCase()}-${year}`;
    const sequence = await this.nextSequence(labId, counterKey, session);
    const prefix = lab.accessionPrefixes?.[discipline] ?? lab.accessionPrefix;
    const accessionNumber = formatAccession(lab.accessionFormat, {
      prefix,
      year,
      sequence,
    });
    return { accessionNumber, lab };
  }

  async allocateMrn(labId: string, session: ClientSession): Promise<string> {
    const year = new Date().getUTCFullYear();
    const sequence = await this.nextSequence(labId, `mrn-${year}`, session);
    return formatMrn(year, sequence);
  }

  async update(labId: string, dto: UpdateLabDto): Promise<LabDto> {
    if (dto.accessionFormat) {
      const problem = validateAccessionFormat(dto.accessionFormat);
      if (problem) throw new BadRequestException(problem);
    }

    return withTransaction(this.connection, async (session) => {
      const lab = await this.labModel.findById(labId).session(session).exec();
      if (!lab) throw new NotFoundException('Laboratory not found.');
      const before = toLab(lab);

      if (dto.name !== undefined) lab.name = dto.name.trim();
      if (dto.address !== undefined) lab.address = dto.address.trim() || null;
      if (dto.phone !== undefined) lab.phone = dto.phone.trim() || null;
      if (dto.email !== undefined) lab.email = dto.email.trim() || null;
      if (dto.accessionPrefix !== undefined) {
        lab.accessionPrefix = dto.accessionPrefix.toUpperCase();
      }
      if (dto.accessionFormat !== undefined) lab.accessionFormat = dto.accessionFormat;
      if (dto.tatWarningPercent !== undefined) lab.tatWarningPercent = dto.tatWarningPercent;
      if (dto.timezone !== undefined) lab.timezone = dto.timezone;
      if (dto.qaSamplingPercent !== undefined) lab.qaSamplingPercent = dto.qaSamplingPercent;
      if (dto.currency !== undefined) lab.currency = dto.currency.toUpperCase();
      if (dto.enabledDisciplines !== undefined) lab.enabledDisciplines = dto.enabledDisciplines;
      if (dto.accessionPrefixes !== undefined) {
        lab.accessionPrefixes = Object.fromEntries(
          Object.entries(dto.accessionPrefixes)
            .map(([discipline, prefix]) => [discipline, prefix.trim().toUpperCase()])
            .filter(([, prefix]) => Boolean(prefix)),
        ) as Record<string, string>;
      }
      if (dto.tatHours) {
        lab.tatHours = {
          FROZEN: dto.tatHours.FROZEN ?? lab.tatHours.FROZEN,
          URGENT: dto.tatHours.URGENT ?? lab.tatHours.URGENT,
          ROUTINE: dto.tatHours.ROUTINE ?? lab.tatHours.ROUTINE,
        };
      }
      if (dto.letterhead) {
        lab.letterhead = this.mergeLetterhead(lab.letterhead, dto.letterhead);
      }

      await lab.save({ session });
      const after = toLab(lab);
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Lab',
          entityId: lab._id.toString(),
          before,
          after,
          metadata: { fields: Object.keys(dto) },
        },
        session,
      );
      return after;
    });
  }

  private mergeLetterhead(current: LabLetterhead | undefined, patch: LetterheadDto): LabLetterhead {
    const merged: LabLetterhead = {
      phone: current?.phone ?? null,
      email: current?.email ?? null,
      website: current?.website ?? null,
      pathologistName: current?.pathologistName ?? null,
      pathologistTitle: current?.pathologistTitle ?? null,
      qualifications: current?.qualifications ?? null,
      signatureText: current?.signatureText ?? null,
      footerNote: current?.footerNote ?? null,
    };
    for (const key of Object.keys(patch) as Array<keyof LetterheadDto>) {
      const value = patch[key];
      if (value !== undefined) {
        merged[key] = value.trim() || null;
      }
    }
    return merged;
  }
}
