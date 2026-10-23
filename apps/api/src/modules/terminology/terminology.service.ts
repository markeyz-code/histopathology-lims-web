import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CODING_SYSTEM_LABELS, type CodingSystem, type TerminologyCode } from '@lims/shared';
import { buildPaginated } from '../../common/utils/format';
import { AuditService } from '../audit/audit.service';
import { TerminologyModelName, type TerminologyEntity } from './terminology.schema';
import type {
  ImportTerminologyDto,
  TerminologyCodeDto,
  TerminologyQueryDto,
} from './dto/terminology.dto';

@Injectable()
export class TerminologyService {
  constructor(
    @InjectModel(TerminologyModelName)
    private readonly model: Model<TerminologyEntity>,
    private readonly audit: AuditService,
  ) {}

  async search(query: TerminologyQueryDto) {
    const filter: Record<string, unknown> = { active: true };
    if (query.system) filter.system = query.system;
    if (query.q) {
      const regex = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ code: regex }, { display: regex }, { synonyms: regex }];
    }
    const limit = Math.min(query.limit ?? 20, 50);
    const docs = await this.model.find(filter).sort({ system: 1, display: 1 }).limit(limit).exec();
    return buildPaginated(
      docs.map((doc) => this.toDto(doc)),
      docs.length,
      1,
      limit,
    );
  }

  async validate(system: CodingSystem, code: string): Promise<TerminologyCode> {
    const doc = await this.model.findOne({ system, code: code.trim(), active: true }).exec();
    if (!doc) {
      throw new BadRequestException(
        `${code} is not a valid ${CODING_SYSTEM_LABELS[system]} code in this laboratory's terminology.`,
      );
    }
    return this.toDto(doc);
  }

  async find(
    system: CodingSystem,
    code: string | null | undefined,
  ): Promise<TerminologyCode | null> {
    if (!code) return null;
    const doc = await this.model.findOne({ system, code: code.trim(), active: true }).exec();
    return doc ? this.toDto(doc) : null;
  }

  async import(dto: ImportTerminologyDto) {
    let imported = 0;
    for (const code of dto.codes) {
      await this.model
        .updateOne(
          { system: code.system, code: code.code.trim() },
          {
            $set: {
              display: code.display.trim(),
              category: code.category?.trim() || null,
              synonyms: code.synonyms ?? [],
              active: true,
            },
          },
          { upsert: true },
        )
        .exec();
      imported += 1;
    }
    await this.audit.record({
      action: 'IMPORT',
      entityType: 'Terminology',
      after: { imported, systems: [...new Set(dto.codes.map((code) => code.system))] },
    });
    return { imported };
  }

  async seed(codes: TerminologyCodeDto[]): Promise<number> {
    let count = 0;
    for (const code of codes) {
      await this.model
        .updateOne(
          { system: code.system, code: code.code },
          {
            $setOnInsert: {
              system: code.system,
              code: code.code,
              display: code.display,
              category: code.category ?? null,
              synonyms: code.synonyms ?? [],
              active: true,
            },
          },
          { upsert: true },
        )
        .exec();
      count += 1;
    }
    return count;
  }

  private toDto(doc: TerminologyEntity): TerminologyCode {
    return {
      id: doc._id.toString(),
      system: doc.system,
      code: doc.code,
      display: doc.display,
      category: doc.category,
      synonyms: doc.synonyms,
      active: doc.active,
    };
  }
}
