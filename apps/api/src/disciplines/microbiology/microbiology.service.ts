import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  antibioticSchema,
  breakpointSchema,
  cultureSchema,
  cultureUpdateSchema,
  organismSchema,
  stateMachineRegistry,
  susceptibilitySchema,
  type Antibiotic,
  type AntibiogramRow,
  type Breakpoint,
  type Culture,
  type Isolate,
  type Organism,
  type SusceptibilityResult,
} from '@lims/shared';
import type { Actor } from '../../common/utils/actor';
import { AuditService } from '../../core/audit/audit.service';
import { CaseModelName, type CaseEntity } from '../../core/cases/case.schema';
import { PatientModelName, type PatientEntity } from '../../core/patients/patient.schema';
import { TestRequestsService } from '../../core/test-requests/test-requests.service';
import {
  TestRequestModelName,
  type TestRequestEntity,
} from '../../core/test-requests/test-request.schema';
import {
  AntibioticModelName,
  BreakpointModelName,
  CultureModelName,
  IsolateModelName,
  OrganismModelName,
  SusceptibilityModelName,
  type AntibioticEntity,
  type BreakpointEntity,
  type CultureEntity,
  type IsolateEntity,
  type OrganismEntity,
  type SusceptibilityEntity,
} from './microbiology.schema';

@Injectable()
export class MicrobiologyService {
  constructor(
    @InjectModel(OrganismModelName) private readonly organismModel: Model<OrganismEntity>,
    @InjectModel(AntibioticModelName) private readonly antibioticModel: Model<AntibioticEntity>,
    @InjectModel(BreakpointModelName) private readonly breakpointModel: Model<BreakpointEntity>,
    @InjectModel(CultureModelName) private readonly cultureModel: Model<CultureEntity>,
    @InjectModel(IsolateModelName) private readonly isolateModel: Model<IsolateEntity>,
    @InjectModel(SusceptibilityModelName)
    private readonly susceptibilityModel: Model<SusceptibilityEntity>,
    @InjectModel(TestRequestModelName) private readonly requestModel: Model<TestRequestEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    private readonly testRequests: TestRequestsService,
    private readonly audit: AuditService,
  ) {}

  async organisms(): Promise<Organism[]> {
    const rows = await this.organismModel.find({}).sort({ name: 1 }).exec();
    return rows.map((row) => this.toOrganism(row));
  }

  async createOrganism(body: unknown, actor: Actor): Promise<Organism> {
    const parsed = organismSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const row = await this.organismModel.create({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      whonetCode: parsed.data.whonetCode ?? null,
      active: parsed.data.active ?? true,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'Organism',
      entityId: row._id.toString(),
      after: this.toOrganism(row),
      metadata: { actor: actor.userName },
    });
    return this.toOrganism(row);
  }

  async antibiotics(organismCode?: string, cascade = false): Promise<Antibiotic[]> {
    const filter: Record<string, unknown> = {};
    if (organismCode) {
      const breakpointFilter: Record<string, unknown> = {
        organismCode: organismCode.toUpperCase(),
        active: true,
      };
      if (cascade) breakpointFilter.firstLine = true;
      const breakpoints = await this.breakpointModel
        .find(breakpointFilter)
        .select('antibioticCode')
        .exec();
      filter.code = { $in: breakpoints.map((breakpoint) => breakpoint.antibioticCode) };
    }
    const rows = await this.antibioticModel.find(filter).sort({ name: 1 }).exec();
    return rows.map((row) => this.toAntibiotic(row));
  }

  async createAntibiotic(body: unknown, actor: Actor): Promise<Antibiotic> {
    const parsed = antibioticSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const row = await this.antibioticModel.create({
      ...parsed.data,
      code: parsed.data.code.toUpperCase(),
      whonetCode: parsed.data.whonetCode ?? null,
      active: parsed.data.active ?? true,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'Antibiotic',
      entityId: row._id.toString(),
      after: this.toAntibiotic(row),
      metadata: { actor: actor.userName },
    });
    return this.toAntibiotic(row);
  }

  async breakpoints(organism?: string, antibiotic?: string): Promise<Breakpoint[]> {
    const filter: Record<string, unknown> = {};
    if (organism) filter.organismCode = organism.toUpperCase();
    if (antibiotic) filter.antibioticCode = antibiotic.toUpperCase();
    const rows = await this.breakpointModel
      .find(filter)
      .sort({ organismCode: 1, antibioticCode: 1 })
      .exec();
    return rows.map((row) => this.toBreakpoint(row));
  }

  async createBreakpoint(body: unknown, actor: Actor): Promise<Breakpoint> {
    const parsed = breakpointSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const row = await this.breakpointModel.create({
      ...parsed.data,
      organismCode: parsed.data.organismCode.toUpperCase(),
      antibioticCode: parsed.data.antibioticCode.toUpperCase(),
      unit: parsed.data.unit ?? null,
      firstLine: parsed.data.firstLine ?? true,
      active: parsed.data.active ?? true,
    });
    await this.audit.record({
      action: 'CREATE',
      entityType: 'Breakpoint',
      entityId: row._id.toString(),
      after: this.toBreakpoint(row),
      metadata: { actor: actor.userName },
    });
    return this.toBreakpoint(row);
  }

  async cultures(status?: string): Promise<Culture[]> {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const rows = await this.cultureModel.find(filter).sort({ createdAt: -1 }).limit(100).exec();
    return Promise.all(rows.map((row) => this.toCulture(row)));
  }

  async culture(
    id: string,
  ): Promise<Culture & { isolates: Isolate[]; susceptibilities: SusceptibilityResult[] }> {
    const row = await this.cultureModel.findById(id).exec();
    if (!row) throw new NotFoundException('Culture not found.');
    const [isolates, susceptibilities] = await Promise.all([
      this.isolateModel.find({ cultureId: row._id }).sort({ createdAt: 1 }).exec(),
      this.susceptibilityModel.find({ cultureId: row._id }).sort({ createdAt: 1 }).exec(),
    ]);
    return {
      ...(await this.toCulture(row)),
      isolates: isolates.map((isolate) => this.toIsolate(isolate)),
      susceptibilities: susceptibilities.map((susceptibility) =>
        this.toSusceptibility(susceptibility),
      ),
    };
  }

  async createCulture(body: unknown, actor: Actor): Promise<Culture> {
    const parsed = cultureSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const request = await this.requestModel.findById(parsed.data.testRequestId).exec();
    if (!request) throw new NotFoundException('Test request not found.');
    if (request.discipline !== 'MICROBIOLOGY')
      throw new BadRequestException('This request is not a microbiology culture.');
    const existing = await this.cultureModel.findOne({ testRequestId: request._id }).exec();
    if (existing) throw new ConflictException('A culture already exists for this request.');
    const caseDoc = await this.caseModel.findById(request.caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    const culture = await this.cultureModel.create({
      caseId: caseDoc._id,
      patientId: caseDoc.patientId,
      testRequestId: request._id,
      status: 'RECEIVED',
      specimenType: parsed.data.specimenType,
      plateType: parsed.data.plateType ?? null,
      media: parsed.data.media ?? null,
      incubation: parsed.data.incubation ?? null,
      notes: parsed.data.notes ?? null,
      resistanceFlags: [],
      createdBy: actor.userId ? new Types.ObjectId(actor.userId) : null,
    });
    await this.testRequests.setStatus(request._id, 'IN_PROGRESS');
    await this.audit.record({
      action: 'CREATE',
      entityType: 'Culture',
      entityId: culture._id.toString(),
      caseId: caseDoc._id.toString(),
      after: await this.toCulture(culture),
      metadata: { actor: actor.userName },
    });
    return this.toCulture(culture);
  }

  async updateCulture(id: string, body: unknown, actor: Actor): Promise<Culture> {
    const parsed = cultureUpdateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const culture = await this.cultureModel.findById(id).exec();
    if (!culture) throw new NotFoundException('Culture not found.');
    const before = culture.status;
    if (parsed.data.status && parsed.data.status !== culture.status) {
      const check = stateMachineRegistry.check(
        'MICROBIOLOGY',
        'CULTURE',
        culture.status,
        parsed.data.status,
      );
      if (!check.ok) throw new ConflictException(check.reason);
      culture.status = parsed.data.status;
    }
    if (parsed.data.plateType !== undefined) culture.plateType = parsed.data.plateType ?? null;
    if (parsed.data.media !== undefined) culture.media = parsed.data.media ?? null;
    if (parsed.data.incubation !== undefined) culture.incubation = parsed.data.incubation ?? null;
    if (parsed.data.organismCode !== undefined)
      culture.organismCode = parsed.data.organismCode?.toUpperCase() ?? null;
    if (parsed.data.colonyCount !== undefined)
      culture.colonyCount = parsed.data.colonyCount ?? null;
    if (parsed.data.notes !== undefined) culture.notes = parsed.data.notes ?? null;
    if (parsed.data.resistanceFlags) culture.resistanceFlags = parsed.data.resistanceFlags;
    if (culture.status === 'REPORTED') culture.reportedAt = new Date();
    await culture.save();
    if (culture.status === 'REPORTED')
      await this.testRequests.setStatus(culture.testRequestId, 'VERIFIED');
    await this.audit.record({
      action: 'UPDATE',
      entityType: 'Culture',
      entityId: culture._id.toString(),
      caseId: culture.caseId.toString(),
      before: { status: before },
      after: { status: culture.status },
      metadata: { actor: actor.userName },
    });
    return this.toCulture(culture);
  }

  async addIsolate(cultureId: string, body: unknown, actor: Actor): Promise<Isolate> {
    const culture = await this.cultureModel.findById(cultureId).exec();
    if (!culture) throw new NotFoundException('Culture not found.');
    const parsed = organismSchema
      .partial()
      .extend({ notes: organismSchema.shape.name.optional() })
      .safeParse(body);
    const raw = body as { organismCode?: string; notes?: string };
    const organism = raw.organismCode
      ? await this.organismModel.findOne({ code: raw.organismCode.toUpperCase() }).exec()
      : null;
    if (!organism) throw new NotFoundException('Organism not found.');
    if (parsed.success) {
      // organismSchema is only used to keep the body non-empty for older clients; the organism lookup is authoritative.
    }
    const isolate = await this.isolateModel.create({
      cultureId: culture._id,
      organismCode: organism.code,
      organismName: organism.name,
      gram: organism.gram,
      notes: raw.notes ?? null,
    });
    culture.organismCode = organism.code;
    if (culture.status === 'READ') culture.status = 'ID_DONE';
    else if (culture.status === 'RECEIVED' || culture.status === 'PLATED')
      culture.status = 'ID_DONE';
    await culture.save();
    await this.audit.record({
      action: 'CREATE',
      entityType: 'Isolate',
      entityId: isolate._id.toString(),
      caseId: culture.caseId.toString(),
      after: this.toIsolate(isolate),
      metadata: { actor: actor.userName },
    });
    return this.toIsolate(isolate);
  }

  async susceptibility(
    cultureId: string,
    body: unknown,
    actor: Actor,
  ): Promise<SusceptibilityResult> {
    const parsed = susceptibilitySchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const culture = await this.cultureModel.findById(cultureId).exec();
    if (!culture) throw new NotFoundException('Culture not found.');
    const isolate = await this.isolateModel.findById(parsed.data.isolateId).exec();
    if (!isolate || !isolate.cultureId.equals(culture._id))
      throw new NotFoundException('Isolate not found.');
    const antibiotic = await this.antibioticModel
      .findOne({ code: parsed.data.antibioticCode.toUpperCase() })
      .exec();
    if (!antibiotic) throw new NotFoundException('Antibiotic not found.');
    const breakpoint = await this.breakpointModel
      .findOne({
        organismCode: isolate.organismCode,
        antibioticCode: antibiotic.code,
        method: parsed.data.method,
        active: true,
      })
      .exec();
    if (!breakpoint)
      throw new BadRequestException(
        `No ${parsed.data.method} breakpoint for ${isolate.organismCode}/${antibiotic.code}.`,
      );
    const interpretation = this.interpret(parsed.data.value, breakpoint);
    const flags = new Set(culture.resistanceFlags);
    if (interpretation === 'R' && antibiotic.code === 'OXA' && isolate.organismCode.includes('SA'))
      flags.add('MRSA');
    if (
      interpretation === 'R' &&
      ['CAZ', 'CRO', 'CTX'].includes(antibiotic.code) &&
      ['EC', 'KP'].includes(isolate.organismCode)
    )
      flags.add('ESBL');
    if (interpretation === 'R' && antibiotic.code === 'VAN') flags.add('VRE');
    if (interpretation === 'R' && antibiotic.code === 'MEM' && isolate.organismCode.includes('KP'))
      flags.add('CRE');
    culture.resistanceFlags = Array.from(flags);
    if (culture.status !== 'AST_DONE' && culture.status !== 'REPORTED') {
      culture.status = culture.status === 'ID_DONE' ? 'AST_DONE' : 'AST_DONE';
    }
    await culture.save();
    const row = await this.susceptibilityModel
      .findOneAndUpdate(
        { cultureId: culture._id, antibioticCode: antibiotic.code },
        {
          $set: {
            isolateId: isolate._id,
            antibioticName: antibiotic.name,
            method: parsed.data.method,
            value: parsed.data.value,
            interpretation,
            breakpointId: breakpoint._id,
            standard: breakpoint.standard,
            unit: breakpoint.unit,
            notes: parsed.data.notes ?? null,
          },
        },
        { upsert: true, new: true },
      )
      .exec();
    await this.audit.record({
      action: 'CREATE',
      entityType: 'SusceptibilityResult',
      entityId: row!._id.toString(),
      caseId: culture.caseId.toString(),
      after: this.toSusceptibility(row!),
      metadata: { actor: actor.userName, rule: 'AST_BREAKPOINT', breakpoint: breakpoint.standard },
    });
    return this.toSusceptibility(row!);
  }

  async antibiogram(from?: string, to?: string): Promise<AntibiogramRow[]> {
    const filter: Record<string, unknown> = {};
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      filter.createdAt = range;
    }
    const results = await this.susceptibilityModel.find(filter).exec();
    const organisms = await this.organismModel.find({}).exec();
    const antibiotics = await this.antibioticModel.find({}).exec();
    const orgMap = new Map(organisms.map((organism) => [organism.code, organism]));
    const abxMap = new Map(antibiotics.map((antibiotic) => [antibiotic.code, antibiotic]));
    const map = new Map<string, AntibiogramRow>();
    for (const result of results) {
      const isolate = await this.isolateModel.findById(result.isolateId).exec();
      const organismCode = isolate?.organismCode ?? 'UNKNOWN';
      const key = `${organismCode}:${result.antibioticCode}`;
      const row = map.get(key) ?? {
        organismCode,
        organismName: orgMap.get(organismCode)?.name ?? isolate?.organismName ?? organismCode,
        antibioticCode: result.antibioticCode,
        antibioticName: abxMap.get(result.antibioticCode)?.name ?? result.antibioticName,
        tested: 0,
        susceptible: 0,
        intermediate: 0,
        resistant: 0,
        susceptibilityPercent: 0,
      };
      row.tested += 1;
      if (result.interpretation === 'S') row.susceptible += 1;
      else if (result.interpretation === 'R') row.resistant += 1;
      else row.intermediate += 1;
      row.susceptibilityPercent = row.tested
        ? Math.round((row.susceptible / row.tested) * 1000) / 10
        : 0;
      map.set(key, row);
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        a.organismName.localeCompare(b.organismName) ||
        a.antibioticName.localeCompare(b.antibioticName),
    );
  }

  async whonet(from?: string, to?: string): Promise<string> {
    const rows = await this.antibiogram(from, to);
    const header = [
      'Organism',
      'Antibiotic',
      'Tested',
      'Susceptible',
      'Intermediate',
      'Resistant',
      'S_Percent',
      'Standard',
    ];
    const lines = [
      header.join(';'),
      ...rows.map((row) =>
        [
          row.organismCode,
          row.antibioticCode,
          row.tested,
          row.susceptible,
          row.intermediate,
          row.resistant,
          row.susceptibilityPercent,
          'CLSI/EUCAST',
        ].join(';'),
      ),
    ];
    return lines.join('\n');
  }

  private interpret(value: number, breakpoint: BreakpointEntity) {
    if (breakpoint.method === 'MIC') {
      if (value <= breakpoint.susceptibleThreshold) return 'S' as const;
      if (value >= breakpoint.resistantThreshold) return 'R' as const;
      return 'I' as const;
    }
    if (value >= breakpoint.susceptibleThreshold) return 'S' as const;
    if (value <= breakpoint.resistantThreshold) return 'R' as const;
    return 'I' as const;
  }

  private async toCulture(culture: CultureEntity): Promise<Culture> {
    const [caseDoc, patient, organism] = await Promise.all([
      this.caseModel.findById(culture.caseId).exec(),
      this.patientModel.findById(culture.patientId).exec(),
      culture.organismCode
        ? this.organismModel.findOne({ code: culture.organismCode }).exec()
        : null,
    ]);
    return {
      id: culture._id.toString(),
      caseId: culture.caseId.toString(),
      accessionNumber: caseDoc?.accessionNumber ?? '—',
      patientId: culture.patientId.toString(),
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : '—',
      testRequestId: culture.testRequestId.toString(),
      status: culture.status,
      specimenType: culture.specimenType,
      plateType: culture.plateType,
      media: culture.media,
      incubation: culture.incubation,
      organismCode: culture.organismCode,
      organismName: organism?.name ?? null,
      colonyCount: culture.colonyCount,
      notes: culture.notes,
      resistanceFlags: culture.resistanceFlags,
      reportedAt: culture.reportedAt?.toISOString() ?? null,
      createdAt: culture.createdAt.toISOString(),
      updatedAt: culture.updatedAt.toISOString(),
    };
  }

  private toOrganism(row: OrganismEntity): Organism {
    return {
      id: row._id.toString(),
      code: row.code,
      name: row.name,
      gram: row.gram,
      whonetCode: row.whonetCode,
      active: row.active,
    };
  }
  private toAntibiotic(row: AntibioticEntity): Antibiotic {
    return {
      id: row._id.toString(),
      code: row.code,
      name: row.name,
      className: row.className,
      whonetCode: row.whonetCode,
      active: row.active,
    };
  }
  private toBreakpoint(row: BreakpointEntity): Breakpoint {
    return {
      id: row._id.toString(),
      standard: row.standard,
      version: row.version,
      organismCode: row.organismCode,
      antibioticCode: row.antibioticCode,
      method: row.method,
      susceptibleThreshold: row.susceptibleThreshold,
      resistantThreshold: row.resistantThreshold,
      unit: row.unit,
      firstLine: row.firstLine,
      active: row.active,
    };
  }
  private toIsolate(row: IsolateEntity): Isolate {
    return {
      id: row._id.toString(),
      cultureId: row.cultureId.toString(),
      organismCode: row.organismCode,
      organismName: row.organismName,
      gram: row.gram,
      notes: row.notes,
    };
  }
  private toSusceptibility(row: SusceptibilityEntity): SusceptibilityResult {
    return {
      id: row._id.toString(),
      cultureId: row.cultureId.toString(),
      isolateId: row.isolateId.toString(),
      antibioticCode: row.antibioticCode,
      antibioticName: row.antibioticName,
      method: row.method,
      value: row.value,
      interpretation: row.interpretation,
      breakpointId: row.breakpointId?.toString() ?? null,
      standard: row.standard,
      unit: row.unit,
      notes: row.notes,
    };
  }
}
