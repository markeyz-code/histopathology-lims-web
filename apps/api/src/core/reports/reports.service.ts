import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession, type Connection } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import {
  canAmendReport,
  checkSignOut,
  flattenProtocolFields,
  generateNarrative,
  protocolContentSchema,
  reportCompleteness,
  validateReportData,
  type ProtocolContent,
  type ReportData,
  type ReportDetail,
  type VerifyReportResult,
} from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { randomVerificationCode } from '../../common/utils/crypto';
import { runWithSystemTenant } from '../../common/context/tenant-context';
import { withTransaction } from '../../common/utils/transaction';
import { toReportSummary } from '../../common/serializers/entities';
import { AuditService } from '../audit/audit.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { CaseWorkflowService } from '../custody/case-workflow.service';
import { TestRequestsService } from '../test-requests/test-requests.service';
import { JobsService } from '../jobs/jobs.service';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { QaService } from '../../extensions/qa/qa.service';
import { TerminologyService } from '../../extensions/terminology/terminology.service';
import { UserModelName, type UserEntity } from '../users/user.schema';
import { ReportAssemblerService } from './report-assembler.service';
import { ReportPortRegistry, type GeneratedPdf } from './report-ports';
import { ReportVersionModelName, type ReportVersionEntity } from './report-version.schema';
import { ReportModelName, type ReportEntity } from './report.schema';
import type {
  AmendReportDto,
  CodingDto,
  CreateReportDto,
  ReleaseReportDto,
  UpdateReportDto,
} from './dto/report.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ReportModelName) private readonly reportModel: Model<ReportEntity>,
    @InjectModel(ReportVersionModelName)
    private readonly versionModel: Model<ReportVersionEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    private readonly assembler: ReportAssemblerService,
    private readonly workflow: CaseWorkflowService,
    private readonly testRequests: TestRequestsService,
    private readonly reportPorts: ReportPortRegistry,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly qa: QaService,
    private readonly terminology: TerminologyService,
  ) {}

  async getByCase(caseId: string): Promise<ReportDetail | null> {
    return this.assembler.forCase(caseId);
  }

  async getById(reportId: string): Promise<ReportDetail> {
    const detail = await this.assembler.byId(reportId);
    if (!detail) throw new NotFoundException('Report not found.');
    return detail;
  }

  async createDraft(
    caseId: string,
    dto: CreateReportDto,
    actor: AuthenticatedUser,
  ): Promise<ReportDetail> {
    const reportId = await withTransaction(this.connection, async (session) => {
      const caseDoc = await this.caseModel.findById(caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');
      if (caseDoc.status === 'REPORTED' || caseDoc.status === 'AMENDED') {
        throw new ConflictException('This case already has a signed report.');
      }
      const existing = await this.reportModel
        .findOne({ caseId: caseDoc._id })
        .session(session)
        .exec();
      if (existing) throw new ConflictException('A report already exists for this case.');

      const catalog = this.reportPorts.protocols('HISTOPATHOLOGY');
      const protocol = catalog ? await catalog.findById(dto.protocolId, session) : null;
      if (!protocol) throw new NotFoundException('Protocol not found.');
      if (!protocol.active) throw new ConflictException('This protocol is inactive.');

      const content = this.parseContent(protocol.content);
      const data: ReportData = {};
      for (const field of flattenProtocolFields(content)) {
        if (field.defaultValue !== undefined) data[field.key] = field.defaultValue;
      }
      const narrative = generateNarrative(content, data);
      const completeness = reportCompleteness(content, data);

      const report = new this.reportModel({
        caseId: caseDoc._id,
        protocolId: protocol._id,
        protocolSnapshot: {
          protocolId: protocol._id.toString(),
          key: protocol.key,
          title: protocol.title,
          cancerType: protocol.cancerType,
          subspecialty: protocol.subspecialty,
          version: protocol.version,
          content,
        },
        protocolVersion: protocol.version,
        status: 'DRAFT',
        data,
        narrative,
        version: 0,
        requiredComplete: completeness.complete,
        missingRequired: completeness.missingRequired,
        createdBy: new Types.ObjectId(actor.id),
      });
      await report.save({ session });

      await this.workflow.advance(
        caseDoc._id,
        'PENDING_REVIEW',
        this.toActor(actor),
        session,
        'Report draft started',
      );

      await this.audit.record(
        {
          action: 'CREATE',
          entityType: 'Report',
          entityId: report._id.toString(),
          caseId: caseDoc._id.toString(),
          after: {
            status: report.status,
            protocol: protocol.key,
            protocolVersion: protocol.version,
            version: report.version,
          },
        },
        session,
      );
      return report._id.toString();
    });

    return this.getById(reportId);
  }

  async updateDraft(
    reportId: string,
    dto: UpdateReportDto,
    actor: AuthenticatedUser,
  ): Promise<ReportDetail> {
    await withTransaction(this.connection, async (session) => {
      const report = await this.reportModel.findById(reportId).session(session).exec();
      if (!report) throw new NotFoundException('Report not found.');
      if (report.status !== 'DRAFT') {
        throw new ConflictException(
          'This report is signed out and locked. Use the amendment flow to change it.',
        );
      }
      const content = this.parseContent(report.protocolSnapshot.content);
      const validation = validateReportData(content, dto.data);
      if (validation.errors.length > 0) {
        throw new BadRequestException(
          validation.errors.map((issue) => `${issue.label}: ${issue.message}`),
        );
      }
      const completeness = reportCompleteness(content, validation.data);
      const narrative = generateNarrative(content, validation.data);
      const before = {
        data: report.data,
        narrative: report.narrative,
        missingRequired: report.missingRequired,
      };
      report.data = validation.data;
      report.narrative = narrative;
      if (dto.coding) report.coding = await this.normalizeCoding(dto.coding, report.coding);
      report.requiredComplete = completeness.complete;
      report.missingRequired = completeness.missingRequired;
      report.pdfPath = null;
      await report.save({ session });

      await this.audit.record(
        {
          action: 'UPDATE',
          entityType: 'Report',
          entityId: report._id.toString(),
          caseId: report.caseId.toString(),
          before,
          after: {
            data: report.data,
            narrative: report.narrative,
            missingRequired: report.missingRequired,
          },
          metadata: { actor: actor.email },
        },
        session,
      );
    });
    return this.getById(reportId);
  }

  async signOut(reportId: string, actor: AuthenticatedUser): Promise<ReportDetail> {
    await withTransaction(this.connection, async (session) => {
      const report = await this.reportModel.findById(reportId).session(session).exec();
      if (!report) throw new NotFoundException('Report not found.');
      const content = this.parseContent(report.protocolSnapshot.content);

      const check = checkSignOut(report.status, content, report.data);
      if (!check.ok) {
        if (report.status !== 'DRAFT') throw new ConflictException(check.reason);
        throw new BadRequestException(check.reason);
      }

      const validation = validateReportData(content, report.data);
      if (validation.errors.length > 0 || validation.missingRequired.length > 0) {
        throw new BadRequestException(
          validation.errors
            .map((issue) => `${issue.label}: ${issue.message}`)
            .concat(validation.missingRequired.map((label) => `${label} is required.`)),
        );
      }

      const version = report.version + 1;
      const verificationCode =
        report.verificationCode ?? (await this.allocateVerificationCode(session));
      const now = new Date();
      const before = {
        status: report.status,
        version: report.version,
        signedOutAt: report.signedOutAt?.toISOString() ?? null,
      };

      report.data = validation.data;
      report.narrative = generateNarrative(content, validation.data);
      report.status = 'SIGNED_OUT';
      report.version = version;
      report.signedOutAt = now;
      report.signedOutBy = new Types.ObjectId(actor.id);
      report.verificationCode = verificationCode;
      report.requiredComplete = true;
      report.missingRequired = [];
      report.releasedAt = null;
      report.releasedBy = null;
      report.releaseNote = null;
      report.pdfPath = null;
      report.pdfGeneratedAt = null;
      await report.save({ session });

      await this.versionModel.create(
        [
          {
            reportId: report._id,
            caseId: report.caseId,
            version,
            action: 'SIGN_OUT',
            data: validation.data,
            narrative: report.narrative,
            reason: null,
            createdBy: new Types.ObjectId(actor.id),
          },
        ],
        { session },
      );

      const finalizer = this.reportPorts.finalizer('HISTOPATHOLOGY');
      if (finalizer)
        await finalizer.markReported(report.caseId.toString(), this.toActor(actor), session);

      await this.audit.record(
        {
          action: 'SIGN_OUT',
          entityType: 'Report',
          entityId: report._id.toString(),
          caseId: report.caseId.toString(),
          before,
          after: {
            status: 'SIGNED_OUT',
            version,
            signedOutAt: now.toISOString(),
            verificationCode,
          },
        },
        session,
      );
    });

    const detail = await this.getById(reportId);
    await this.afterSignOut(detail, actor.labId);
    return detail;
  }

  async amend(
    reportId: string,
    dto: AmendReportDto,
    actor: AuthenticatedUser,
  ): Promise<ReportDetail> {
    await withTransaction(this.connection, async (session) => {
      const report = await this.reportModel.findById(reportId).session(session).exec();
      if (!report) throw new NotFoundException('Report not found.');
      if (!canAmendReport(report.status)) {
        throw new ConflictException('Only a signed-out report can be amended.');
      }
      const content = this.parseContent(report.protocolSnapshot.content);
      const candidate = dto.data ?? report.data;
      const validation = validateReportData(content, candidate);
      if (validation.errors.length > 0) {
        throw new BadRequestException(
          validation.errors.map((issue) => `${issue.label}: ${issue.message}`),
        );
      }
      if (validation.missingRequired.length > 0) {
        throw new BadRequestException(
          validation.missingRequired.map((label) => `${label} is required.`),
        );
      }

      const version = report.version + 1;
      const now = new Date();
      const before = {
        status: report.status,
        version: report.version,
        data: report.data,
        narrative: report.narrative,
      };

      report.data = validation.data;
      report.narrative = generateNarrative(content, validation.data);
      if (dto.coding) report.coding = await this.normalizeCoding(dto.coding, report.coding);
      report.status = 'AMENDED';
      report.version = version;
      report.amendedAt = now;
      report.amendmentReason = dto.reason;
      report.signedOutAt = now;
      report.signedOutBy = new Types.ObjectId(actor.id);
      report.requiredComplete = true;
      report.missingRequired = [];
      report.releasedAt = null;
      report.releasedBy = null;
      report.releaseNote = null;
      report.pdfPath = null;
      report.pdfGeneratedAt = null;
      await report.save({ session });

      await this.versionModel.create(
        [
          {
            reportId: report._id,
            caseId: report.caseId,
            version,
            action: 'AMEND',
            data: validation.data,
            narrative: report.narrative,
            reason: dto.reason,
            createdBy: new Types.ObjectId(actor.id),
          },
        ],
        { session },
      );

      await this.workflow.amend(report.caseId, this.toActor(actor), session, dto.reason);

      await this.audit.record(
        {
          action: 'AMEND',
          entityType: 'Report',
          entityId: report._id.toString(),
          caseId: report.caseId.toString(),
          before,
          after: {
            status: 'AMENDED',
            version,
            data: report.data,
            narrative: report.narrative,
            reason: dto.reason,
          },
          metadata: { reason: dto.reason },
        },
        session,
      );
    });

    const detail = await this.getById(reportId);
    await this.afterSignOut(detail, actor.labId);
    return detail;
  }

  async release(
    reportId: string,
    dto: ReleaseReportDto,
    actor: AuthenticatedUser,
  ): Promise<ReportDetail> {
    const released = await withTransaction(this.connection, async (session) => {
      const report = await this.reportModel.findById(reportId).session(session).exec();
      if (!report) throw new NotFoundException('Report not found.');
      if (report.status !== 'SIGNED_OUT' && report.status !== 'AMENDED') {
        throw new ConflictException('Only a signed report can be released to the referrer.');
      }
      if (report.releasedAt && report.status !== 'AMENDED') {
        return { alreadyReleased: true };
      }
      const caseDoc = await this.caseModel.findById(report.caseId).session(session).exec();
      if (!caseDoc) throw new NotFoundException('Case not found.');
      const patient = await this.patientModel.findById(caseDoc.patientId).session(session).exec();
      if (!patient) throw new NotFoundException('Patient not found.');

      const now = new Date();
      report.releasedAt = now;
      report.releasedBy = new Types.ObjectId(actor.id);
      report.releaseNote = dto?.note?.trim() || null;
      await report.save({ session });
      await this.testRequests.markReleased(report.caseId, session);

      await this.audit.record(
        {
          action: 'RELEASE',
          entityType: 'Report',
          entityId: report._id.toString(),
          caseId: report.caseId.toString(),
          after: {
            releasedAt: now.toISOString(),
            releasedBy: actor.email,
            patient: `${patient.firstName} ${patient.lastName}`,
          },
          metadata: { note: report.releaseNote },
        },
        session,
      );

      return {
        alreadyReleased: false,
        caseId: caseDoc._id.toString(),
        patientName: `${patient.firstName} ${patient.lastName}`,
        email: caseDoc.referringClinician.email,
        phone: caseDoc.referringClinician.phone,
        referrerUserId: caseDoc.referringClinician.referrerUserId?.toString() ?? null,
        accessionNumber: caseDoc.accessionNumber,
      };
    });

    if (!released.alreadyReleased) {
      const portalUrl = `${this.config.get<string>('PUBLIC_WEB_URL') ?? ''}/portal/login`;
      await this.jobs.enqueueNotification({
        labId: actor.labId,
        type: 'REPORT_RELEASED',
        title: `Report released — ${released.accessionNumber}`,
        body: `The histopathology report for ${released.patientName} (${released.accessionNumber}) has been released to your referral portal. Sign in at ${portalUrl} with your email to view it.`,
        caseId: released.caseId,
        entityType: 'Report',
        entityId: reportId,
        userId: released.referrerUserId,
        role: null,
        channels: [
          ...(released.referrerUserId ? (['IN_APP'] as const) : []),
          ...(released.email ? (['EMAIL'] as const) : []),
          ...(released.phone ? (['WHATSAPP'] as const) : []),
        ],
        recipient: { email: released.email, phone: released.phone, name: released.patientName },
        metadata: { portalUrl, accessionNumber: released.accessionNumber },
      });
    }

    return this.getById(reportId);
  }

  private async normalizeCoding(
    input: CodingDto,
    current: ReportEntity['coding'] | undefined,
  ): Promise<ReportEntity['coding']> {
    const snomed =
      input.snomedCode === undefined
        ? null
        : await this.terminology.find('SNOMED_CT', input.snomedCode);
    if (input.snomedCode && !snomed) {
      throw new BadRequestException(`${input.snomedCode} is not a configured SNOMED CT code.`);
    }
    const morphology =
      input.icdo3MorphologyCode === undefined
        ? null
        : await this.terminology.find('ICD_O_3_MORPHOLOGY', input.icdo3MorphologyCode);
    if (input.icdo3MorphologyCode && !morphology) {
      throw new BadRequestException(
        `${input.icdo3MorphologyCode} is not a configured ICD-O-3 morphology code.`,
      );
    }
    const topography =
      input.icdo3TopographyCode === undefined
        ? null
        : await this.terminology.find('ICD_O_3_TOPOGRAPHY', input.icdo3TopographyCode);
    if (input.icdo3TopographyCode && !topography) {
      throw new BadRequestException(
        `${input.icdo3TopographyCode} is not a configured ICD-O-3 topography code.`,
      );
    }
    return {
      snomedCode:
        input.snomedCode === undefined ? (current?.snomedCode ?? null) : (snomed?.code ?? null),
      snomedDisplay:
        input.snomedCode === undefined
          ? (current?.snomedDisplay ?? null)
          : (snomed?.display ?? input.snomedDisplay?.trim() ?? null),
      icdo3MorphologyCode:
        input.icdo3MorphologyCode === undefined
          ? (current?.icdo3MorphologyCode ?? null)
          : (morphology?.code ?? null),
      icdo3MorphologyDisplay:
        input.icdo3MorphologyCode === undefined
          ? (current?.icdo3MorphologyDisplay ?? null)
          : (morphology?.display ?? input.icdo3MorphologyDisplay?.trim() ?? null),
      icdo3TopographyCode:
        input.icdo3TopographyCode === undefined
          ? (current?.icdo3TopographyCode ?? null)
          : (topography?.code ?? null),
      icdo3TopographyDisplay:
        input.icdo3TopographyCode === undefined
          ? (current?.icdo3TopographyDisplay ?? null)
          : (topography?.display ?? input.icdo3TopographyDisplay?.trim() ?? null),
    };
  }

  async enqueuePdf(
    reportId: string,
    actor: AuthenticatedUser,
  ): Promise<{ queued: boolean; reportId: string; version: number }> {
    const report = await this.reportModel.findById(reportId).exec();
    if (!report) throw new NotFoundException('Report not found.');
    return this.jobs.enqueuePdf(reportId, actor.labId, report.version);
  }

  async getPdf(reportId: string): Promise<GeneratedPdf> {
    const renderer = this.reportPorts.renderer('HISTOPATHOLOGY');
    if (!renderer) throw new NotFoundException('Report renderer is not available.');
    return renderer.getOrGenerate(reportId);
  }

  async verify(code: string): Promise<VerifyReportResult> {
    return runWithSystemTenant('verify-report', '', async () => {
      const normalized = code.trim().toUpperCase();
      const report = await this.reportModel.findOne({ verificationCode: normalized }).exec();
      if (!report || report.status === 'DRAFT' || !report.signedOutAt) {
        throw new NotFoundException('No signed report matches this verification code.');
      }
      const caseDoc = await this.caseModel.findById(report.caseId).exec();
      if (!caseDoc) throw new NotFoundException('No report matches this verification code.');
      const patient = await this.patientModel.findById(caseDoc.patientId).exec();
      const lab = await this.labModel.findById(report.labId).exec();
      const signer = report.signedOutBy
        ? await this.userModel.findById(report.signedOutBy).exec()
        : null;

      const initials = patient
        ? `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase()
        : '—';

      return {
        valid: true,
        labName: lab?.name ?? 'Histopathology laboratory',
        labCode: lab?.code ?? '',
        accessionNumber: caseDoc.accessionNumber,
        patientInitials: initials,
        status: report.status,
        signedOutAt: report.signedOutAt.toISOString(),
        amendedAt: report.amendedAt?.toISOString() ?? null,
        pathologistName: signer?.name ?? null,
        verificationCode: normalized,
      };
    });
  }

  async summaryForCase(caseId: string) {
    const report = await this.reportModel.findOne({ caseId: new Types.ObjectId(caseId) }).exec();
    return report ? toReportSummary(report) : null;
  }

  private async afterSignOut(detail: ReportDetail, labId: string): Promise<void> {
    try {
      await this.jobs.enqueuePdf(detail.id, labId, detail.version);
    } catch (error) {
      this.logger.error({ err: error }, 'Could not enqueue report PDF.');
    }
    try {
      const amended = detail.status === 'AMENDED';
      await this.jobs.enqueueNotification({
        labId,
        type: amended ? 'REPORT_AMENDED' : 'REPORT_SIGNED_OUT',
        title: amended ? 'Report amended' : 'Report signed out',
        body: amended
          ? 'An amended histopathology report is ready for release.'
          : 'A histopathology report has been signed out and is ready for release.',
        caseId: detail.caseId,
        entityType: 'Report',
        entityId: detail.id,
        role: 'LAB_ADMIN',
      });
    } catch (error) {
      this.logger.error({ err: error }, 'Could not enqueue report notification.');
    }
    try {
      await this.qa.maybeCreatePeerReview(detail.id, {
        id: detail.signedOutBy?.id ?? '',
        labId,
        name: detail.signedOutBy?.name ?? '',
        email: detail.signedOutBy?.email ?? '',
        role: 'PATHOLOGIST',
        subspecialties: detail.signedOutBy?.subspecialties ?? [],
        disciplines: [],
        labEnabledDisciplines: [],
      });
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not create a sampled QA review.');
    }
  }

  private toActor(user: AuthenticatedUser) {
    return { userId: user.id, userName: user.name, userRole: user.role };
  }

  private parseContent(raw: unknown): ProtocolContent {
    const parsed = protocolContentSchema.safeParse(raw);
    if (!parsed.success) {
      throw new NotFoundException('The report protocol snapshot is invalid.');
    }
    return parsed.data;
  }

  private async allocateVerificationCode(session: ClientSession): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = randomVerificationCode();
      const exists = await this.reportModel
        .exists({ verificationCode: code })
        .session(session)
        .exec();
      if (!exists) return code;
    }
    throw new ConflictException('Could not allocate a verification code. Try again.');
  }
}
