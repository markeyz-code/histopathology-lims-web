import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import {
  PRIORITY_RANK,
  computeTat,
  specimenLetter,
  type CaseDetail,
  type CaseListItem,
  type Discipline,
  type Paginated,
  type Priority,
} from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { Actor } from '../../common/utils/actor';
import { makeBarcode } from '../../common/utils/crypto';
import {
  addHours,
  buildPaginated,
  endOfDay,
  escapeRegex,
  parseDateOnly,
  startOfDay,
} from '../../common/utils/format';
import { withTransaction } from '../../common/utils/transaction';
import { toCaseListItem, toPatient, toSpecimen } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { TestRequestsService } from '../test-requests/test-requests.service';
import { CustodyService } from '../custody/custody.service';
import { LabsService } from '../labs/labs.service';
import { PatientsService } from '../patients/patients.service';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { ReportAssemblerService } from '../reports/report-assembler.service';
import { ReportModelName, type ReportEntity } from '../reports/report.schema';
import { SpecimenModelName, type SpecimenEntity } from '../specimens/specimen.schema';
import { UsersService } from '../users/users.service';
import { UserModelName, type UserEntity } from '../users/user.schema';
import { CaseModelName, type CaseEntity } from './case.schema';
import { CaseArtifactRegistry } from './case-artifacts';
import type { AccessionDto, AssignCaseDto, CaseListQueryDto, UpdateCaseDto } from './dto/case.dto';

@Injectable()
export class CasesService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    @InjectModel(ReportModelName) private readonly reportModel: Model<ReportEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    private readonly patientsService: PatientsService,
    private readonly labsService: LabsService,
    private readonly usersService: UsersService,
    private readonly custody: CustodyService,
    private readonly reportAssembler: ReportAssemblerService,
    private readonly artifacts: CaseArtifactRegistry,
    private readonly testRequests: TestRequestsService,
    private readonly audit: AuditService,
  ) {}

  async accession(dto: AccessionDto, actor: AuthenticatedUser): Promise<CaseDetail> {
    const pathologist = dto.assignedPathologistId
      ? await this.usersService.assertActivePathologist(dto.assignedPathologistId)
      : null;

    const caseId = await withTransaction(this.connection, async (session) => {
      const receivedAt = new Date();
      const discipline: Discipline = dto.discipline ?? 'HISTOPATHOLOGY';
      const allocated = await this.labsService.allocateAccession(actor.labId, session, discipline);
      const lab = allocated.lab;
      const patient = await this.patientsService.resolveForAccession(dto.patient, actor, session);
      const referrerEmail = dto.referringClinician.email?.trim().toLowerCase();
      const referrerUser = referrerEmail
        ? await this.userModel
            .findOne({ email: referrerEmail, role: 'REFERRER', active: true })
            .session(session)
            .exec()
        : null;

      const priority = dto.priority;
      const tatHours = lab.tatHours[priority] ?? 72;
      const caseDoc = new this.caseModel({
        accessionNumber: allocated.accessionNumber,
        patientId: patient._id,
        priority,
        priorityRank: PRIORITY_RANK[priority],
        status: 'RECEIVED',
        statusChangedAt: receivedAt,
        clinicalHistory: dto.clinicalHistory.trim(),
        clinicalDiagnosis: dto.clinicalDiagnosis?.trim() || null,
        subspecialty: dto.subspecialty?.trim() || null,
        referringClinician: {
          name: dto.referringClinician.name.trim(),
          facility: dto.referringClinician.facility?.trim() || null,
          phone: dto.referringClinician.phone?.trim() || null,
          email: referrerEmail || null,
          referrerUserId: referrerUser?._id ?? null,
        },
        assignedPathologistId: pathologist ? pathologist._id : null,
        receivedAt,
        tatDeadline: addHours(receivedAt, tatHours),
        summary: {
          specimenCount: dto.specimens.length,
          blockCount: 0,
          slideCount: 0,
        },
        createdBy: new Types.ObjectId(actor.id),
      });
      await caseDoc.save({ session });

      const receivedActor: Actor = {
        userId: actor.id,
        userName: actor.name,
        userRole: actor.role,
      };

      await this.testRequests.createForCase(caseDoc, discipline, receivedActor, session, {
        code: dto.testCode,
        name: dto.testName,
      });

      await this.custody.append(
        {
          entityType: 'CASE',
          entityId: caseDoc._id,
          caseId: caseDoc._id,
          eventType: 'RECEIVED',
          station: null,
          fromState: null,
          toState: 'RECEIVED',
          reason: 'Accessioned',
          metadata: { accessionNumber: caseDoc.accessionNumber, priority },
          timestamp: receivedAt,
        },
        receivedActor,
        session,
      );

      const specimens: SpecimenEntity[] = [];
      for (const [index, input] of dto.specimens.entries()) {
        const sequence = index + 1;
        const specimen = new this.specimenModel({
          caseId: caseDoc._id,
          sequence,
          label: specimenLetter(sequence),
          barcode: makeBarcode('SP'),
          specimenType: input.specimenType.trim(),
          site: input.site.trim(),
          laterality: input.laterality ?? null,
          description: input.description?.trim() || null,
          collectedAt: input.collectedAt ? new Date(input.collectedAt) : null,
          receivedAt,
          status: 'ACCESSIONED',
          currentStation: null,
        });
        await specimen.save({ session });
        specimens.push(specimen);
        await this.custody.append(
          {
            entityType: 'SPECIMEN',
            entityId: specimen._id,
            caseId: caseDoc._id,
            eventType: 'ACCESSIONED',
            station: null,
            fromState: null,
            toState: 'ACCESSIONED',
            reason: 'Accessioned',
            barcode: specimen.barcode,
            metadata: { label: specimen.label, specimenType: specimen.specimenType },
            timestamp: receivedAt,
          },
          receivedActor,
          session,
        );
        await this.audit.record(
          {
            action: 'CREATE',
            entityType: 'Specimen',
            entityId: specimen._id.toString(),
            caseId: caseDoc._id.toString(),
            after: toSpecimen(specimen),
          },
          session,
        );
      }

      await this.audit.record(
        {
          action: 'CREATE',
          entityType: 'Case',
          entityId: caseDoc._id.toString(),
          caseId: caseDoc._id.toString(),
          after: toCaseListItem(caseDoc, patient, pathologist, null, [discipline]),
          metadata: { accessionNumber: caseDoc.accessionNumber, discipline },
        },
        session,
      );

      return caseDoc._id.toString();
    });

    return this.getDetail(caseId);
  }

  async list(query: CaseListQueryDto): Promise<Paginated<CaseListItem>> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.discipline) {
      const caseIds = await this.testRequests.caseIdsForDiscipline(query.discipline);
      filter._id = { $in: caseIds };
    }
    if (query.priority) filter.priority = query.priority;
    if (query.pathologistId) {
      filter.assignedPathologistId = new Types.ObjectId(query.pathologistId);
    }
    if (query.subspecialty) filter.subspecialty = query.subspecialty;
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) {
        const from = parseDateOnly(query.from);
        if (from) range.$gte = startOfDay(from);
      }
      if (query.to) {
        const to = parseDateOnly(query.to);
        if (to) range.$lte = endOfDay(to);
      }
      if (Object.keys(range).length > 0) filter.receivedAt = range;
    }

    if (query.q) {
      const regex = new RegExp(escapeRegex(query.q.trim()), 'i');
      const patients = await this.patientModel
        .find({
          $or: [{ mrn: regex }, { firstName: regex }, { lastName: regex }],
        })
        .select('_id')
        .limit(300)
        .exec();
      const patientIds = patients.map((patient) => patient._id);
      const or: Record<string, unknown>[] = [{ accessionNumber: regex }];
      if (patientIds.length > 0) or.push({ patientId: { $in: patientIds } });
      filter.$or = or;
    }

    const [cases, total] = await Promise.all([
      this.caseModel
        .find(filter)
        .sort({ receivedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.caseModel.countDocuments(filter).exec(),
    ]);

    const items = await this.decorateCases(cases);
    return buildPaginated(items, total, query.page, query.limit);
  }

  async getDetail(caseId: string): Promise<CaseDetail> {
    const caseDoc = await this.caseModel.findById(caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    const patient = await this.patientModel.findById(caseDoc.patientId).exec();
    if (!patient) throw new NotFoundException('Patient not found for this case.');

    const pathologist = caseDoc.assignedPathologistId
      ? await this.userModel.findById(caseDoc.assignedPathologistId).exec()
      : null;
    const report = await this.reportModel.findOne({ caseId: caseDoc._id }).exec();
    const [specimens, testRequests, artifacts, custodyEvents, assembled, lab] = await Promise.all([
      this.specimenModel.find({ caseId: caseDoc._id }).sort({ sequence: 1 }).exec(),
      this.testRequests.forCase(caseDoc._id.toString()),
      this.artifacts.load('HISTOPATHOLOGY', caseDoc._id.toString()),
      this.custody.forCase(caseDoc._id.toString()),
      this.reportAssembler.forCase(caseDoc._id.toString()),
      this.labsService.getById(caseDoc.labId.toString()),
    ]);

    const base = toCaseListItem(
      caseDoc,
      patient,
      pathologist,
      report,
      testRequests.map((request) => request.discipline),
    );
    return {
      ...base,
      clinicalHistory: caseDoc.clinicalHistory,
      clinicalDiagnosis: caseDoc.clinicalDiagnosis,
      specimens: specimens.map(toSpecimen),
      testRequests,
      blocks: artifacts.blocks,
      slides: artifacts.slides,
      custodyEvents,
      report: assembled,
      tat: computeTat(caseDoc.receivedAt, caseDoc.tatDeadline, {
        warningPercent: lab.tatWarningPercent,
        done: caseDoc.status === 'REPORTED' || caseDoc.status === 'AMENDED',
      }),
    };
  }

  async update(caseId: string, dto: UpdateCaseDto, actor: AuthenticatedUser): Promise<CaseDetail> {
    await withTransaction(this.connection, async (session) => {
      const caseDoc = await this.caseModel.findById(caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');
      if (caseDoc.status === 'REPORTED' || caseDoc.status === 'AMENDED') {
        throw new ConflictException('A reported case cannot be edited. Amend the report instead.');
      }

      const before = {
        clinicalHistory: caseDoc.clinicalHistory,
        clinicalDiagnosis: caseDoc.clinicalDiagnosis,
        priority: caseDoc.priority,
        subspecialty: caseDoc.subspecialty,
        tatDeadline: caseDoc.tatDeadline.toISOString(),
      };

      if (dto.clinicalHistory !== undefined) caseDoc.clinicalHistory = dto.clinicalHistory.trim();
      if (dto.clinicalDiagnosis !== undefined) {
        caseDoc.clinicalDiagnosis = dto.clinicalDiagnosis.trim() || null;
      }
      if (dto.subspecialty !== undefined) {
        caseDoc.subspecialty = dto.subspecialty.trim() || null;
      }
      if (dto.priority !== undefined && dto.priority !== caseDoc.priority) {
        const priority: Priority = dto.priority;
        const lab = await this.labsService.getById(caseDoc.labId.toString());
        caseDoc.priority = priority;
        caseDoc.priorityRank = PRIORITY_RANK[priority];
        caseDoc.tatDeadline = addHours(caseDoc.receivedAt, lab.tatHours[priority]);
      }

      await caseDoc.save({ session });
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Case',
          entityId: caseDoc._id.toString(),
          caseId: caseDoc._id.toString(),
          before,
          after: {
            clinicalHistory: caseDoc.clinicalHistory,
            clinicalDiagnosis: caseDoc.clinicalDiagnosis,
            priority: caseDoc.priority,
            subspecialty: caseDoc.subspecialty,
            tatDeadline: caseDoc.tatDeadline.toISOString(),
          },
          metadata: { actor: actor.email },
        },
        session,
      );
    });
    return this.getDetail(caseId);
  }

  async assign(caseId: string, dto: AssignCaseDto, actor: AuthenticatedUser): Promise<CaseDetail> {
    const targetId = dto.pathologistId ?? null;
    if (actor.role === 'PATHOLOGIST') {
      if (targetId !== actor.id) {
        throw new ForbiddenException('Pathologists can only assign cases to themselves.');
      }
    }
    const pathologist = targetId ? await this.usersService.assertActivePathologist(targetId) : null;

    await withTransaction(this.connection, async (session) => {
      const caseDoc = await this.caseModel.findById(caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');
      if (caseDoc.status === 'AMENDED') {
        throw new ConflictException('An amended case cannot be reassigned.');
      }
      const before = caseDoc.assignedPathologistId?.toString() ?? null;
      caseDoc.assignedPathologistId = pathologist ? pathologist._id : null;
      await caseDoc.save({ session });
      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Case',
          entityId: caseDoc._id.toString(),
          caseId: caseDoc._id.toString(),
          before: { assignedPathologistId: before },
          after: { assignedPathologistId: pathologist ? pathologist._id.toString() : null },
        },
        session,
      );
    });
    return this.getDetail(caseId);
  }

  async decorateCases(cases: CaseEntity[]): Promise<CaseListItem[]> {
    if (cases.length === 0) return [];
    const caseIds = cases.map((item) => item._id);
    const patientIds = Array.from(new Set(cases.map((item) => item.patientId.toString())));
    const pathologistIds = Array.from(
      new Set(
        cases
          .map((item) => item.assignedPathologistId?.toString())
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const [patients, pathologists, reports, testRequestMap] = await Promise.all([
      this.patientModel
        .find({ _id: { $in: patientIds.map((id) => new Types.ObjectId(id)) } })
        .exec(),
      pathologistIds.length > 0
        ? this.userModel
            .find({ _id: { $in: pathologistIds.map((id) => new Types.ObjectId(id)) } })
            .exec()
        : Promise.resolve([] as UserEntity[]),
      this.reportModel.find({ caseId: { $in: caseIds } }).exec(),
      this.testRequests.forCases(caseIds),
    ]);

    const patientMap = new Map(patients.map((patient) => [patient._id.toString(), patient]));
    const pathologistMap = new Map(pathologists.map((user) => [user._id.toString(), user]));
    const reportMap = new Map(reports.map((report) => [report.caseId.toString(), report]));

    return cases.map((caseDoc) => {
      const patient = patientMap.get(caseDoc.patientId.toString());
      if (!patient) throw new NotFoundException('Patient missing for a case.');
      const pathologist = caseDoc.assignedPathologistId
        ? (pathologistMap.get(caseDoc.assignedPathologistId.toString()) ?? null)
        : null;
      const report = reportMap.get(caseDoc._id.toString()) ?? null;
      const requests = testRequestMap.get(caseDoc._id.toString()) ?? [];
      return toCaseListItem(
        caseDoc,
        patient,
        pathologist,
        report,
        requests.map((request) => request.discipline),
      );
    });
  }

  async patientSummary(patientId: string) {
    const patient = await this.patientModel.findById(patientId).exec();
    if (!patient) throw new NotFoundException('Patient not found.');
    return toPatient(patient);
  }

  /** Used by labels to verify the case exists inside the tenant. */
  async assertCase(caseId: string): Promise<CaseEntity> {
    const caseDoc = await this.caseModel.findById(caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    return caseDoc;
  }

  async guardEditable(caseId: string): Promise<void> {
    const caseDoc = await this.caseModel.findById(caseId).select('status').exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    if (caseDoc.status === 'REPORTED' || caseDoc.status === 'AMENDED') {
      throw new BadRequestException('A reported case cannot be edited.');
    }
  }
}
