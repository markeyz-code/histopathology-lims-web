import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession, type Connection } from 'mongoose';
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
import { ReportPropagationService } from '../custody/report-propagation.service';
import { JobsService } from '../jobs/jobs.service';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { PdfService, type GeneratedPdf } from '../pdf/pdf.service';
import { ProtocolModelName, type ProtocolEntity } from '../protocols/protocol.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';
import { ReportAssemblerService } from './report-assembler.service';
import { ReportVersionModelName, type ReportVersionEntity } from './report-version.schema';
import { ReportModelName, type ReportEntity } from './report.schema';
import type { AmendReportDto, CreateReportDto, UpdateReportDto } from './dto/report.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(ReportModelName) private readonly reportModel: Model<ReportEntity>,
    @InjectModel(ReportVersionModelName)
    private readonly versionModel: Model<ReportVersionEntity>,
    @InjectModel(ProtocolModelName) private readonly protocolModel: Model<ProtocolEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    private readonly assembler: ReportAssemblerService,
    private readonly propagation: ReportPropagationService,
    private readonly workflow: CaseWorkflowService,
    private readonly pdfService: PdfService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
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

      const protocol = await this.protocolModel.findById(dto.protocolId).session(session).exec();
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

      await this.propagation.markReported(report.caseId, this.toActor(actor), session);

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
      report.status = 'AMENDED';
      report.version = version;
      report.amendedAt = now;
      report.amendmentReason = dto.reason;
      report.signedOutAt = now;
      report.signedOutBy = new Types.ObjectId(actor.id);
      report.requiredComplete = true;
      report.missingRequired = [];
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

  async enqueuePdf(
    reportId: string,
    actor: AuthenticatedUser,
  ): Promise<{ queued: boolean; reportId: string; version: number }> {
    const report = await this.reportModel.findById(reportId).exec();
    if (!report) throw new NotFoundException('Report not found.');
    return this.jobs.enqueuePdf(reportId, actor.labId, report.version);
  }

  async getPdf(reportId: string): Promise<GeneratedPdf> {
    return this.pdfService.getOrGenerate(reportId);
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
