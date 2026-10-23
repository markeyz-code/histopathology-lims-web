import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import type {
  CaseStatus,
  Paginated,
  PortalCaseDetail,
  PortalCaseSummary,
  PortalRequestResult,
  ReferralStatus,
} from '@lims/shared';
import { currentActor, requestAuditContext } from '../../common/utils/actor';
import { runWithTenant } from '../../common/context/tenant-context';
import { buildPaginated } from '../../common/utils/format';
import { hashToken } from '../../common/utils/crypto';
import { toPatientSummary, toReportDetail } from '../../common/serializers/entities';
import { AuthService } from '../../core/auth/auth.service';
import { CaseModelName, type CaseEntity } from '../../core/cases/case.schema';
import { CustodyService } from '../../core/custody/custody.service';
import { LabModelName, type LabEntity } from '../../core/labs/lab.schema';
import { NotificationService } from '../../core/notifications/notification.service';
import { PatientModelName, type PatientEntity } from '../../core/patients/patient.schema';
import { PdfService } from '../../disciplines/histopathology/pdf/pdf.service';
import { ReportAssemblerService } from '../../core/reports/report-assembler.service';
import { ReportModelName, type ReportEntity } from '../../core/reports/report.schema';
import { UserModelName, type UserEntity } from '../../core/users/user.schema';
import { PortalTokenModelName, type PortalTokenEntity } from './portal-token.schema';
import type { PortalRequestDto, PortalVerifyDto } from './dto/portal.dto';

@Injectable()
export class PortalService {
  constructor(
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    @InjectModel(PortalTokenModelName) private readonly tokenModel: Model<PortalTokenEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(ReportModelName) private readonly reportModel: Model<ReportEntity>,
    private readonly auth: AuthService,
    private readonly notifications: NotificationService,
    private readonly assembler: ReportAssemblerService,
    private readonly custody: CustodyService,
    private readonly pdf: PdfService,
    private readonly config: ConfigService,
  ) {}

  async request(dto: PortalRequestDto): Promise<PortalRequestResult> {
    const lab = await this.labModel
      .findOne({ code: dto.labCode.toUpperCase(), active: true })
      .exec();
    const generic: PortalRequestResult = {
      sent: true,
      message: 'If that account exists, a sign-in link and code have been sent.',
    };
    if (!lab) return generic;

    return runWithTenant({ labId: lab._id.toString() }, async () => {
      const user = await this.userModel
        .findOne({ email: dto.email.toLowerCase(), role: 'REFERRER', active: true })
        .exec();
      if (!user) return generic;

      const recent = await this.tokenModel
        .countDocuments({
          userId: user._id,
          consumedAt: null,
          createdAt: { $gte: new Date(Date.now() - 10 * 60_000) },
        })
        .exec();
      if (recent >= 3) return generic;

      const rawToken = randomBytes(32).toString('base64url');
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const ttlMinutes = this.config.get<number>('PORTAL_TOKEN_TTL_MINUTES') ?? 15;
      const context = requestAuditContext();
      const tokenDoc = new this.tokenModel({
        userId: user._id,
        email: user.email,
        tokenHash: hashToken(rawToken),
        codeHash: hashToken(code),
        type: 'MAGIC_LINK',
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
        consumedAt: null,
        attempts: 0,
        ip: context.ip,
        userAgent: context.userAgent,
      });
      await tokenDoc.save();
      await this.tokenModel.updateMany(
        { userId: user._id, _id: { $ne: tokenDoc._id }, consumedAt: null },
        { $set: { consumedAt: new Date() } },
      );

      const link = `${this.config.get<string>('PUBLIC_WEB_URL')}/portal/login?lab=${encodeURIComponent(
        lab.code,
      )}&email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(rawToken)}`;
      const body = [
        `Your ${lab.name} referral portal sign-in code is ${code}. It expires in ${ttlMinutes} minutes.`,
        '',
        `Open ${link} to sign in.`,
        '',
        'If you did not request this, ignore this message.',
      ].join('\n');

      await this.notifications.send({
        labId: lab._id.toString(),
        type: 'PORTAL_MAGIC_LINK',
        title: 'Referral portal sign-in',
        body,
        channels: ['EMAIL', ...(user.phone ? (['SMS'] as const) : [])],
        recipient: { email: user.email, phone: user.phone, name: user.name },
        userId: user._id.toString(),
        entityType: 'Portal',
        entityId: user._id.toString(),
        metadata: { link, purpose: 'portal-login' },
      });

      if (this.config.get<boolean>('PORTAL_DEBUG')) {
        generic.debugCode = code;
        generic.debugToken = rawToken;
      }
      return generic;
    });
  }

  async verify(dto: PortalVerifyDto) {
    const lab = await this.labModel
      .findOne({ code: dto.labCode.toUpperCase(), active: true })
      .exec();
    if (!lab) throw new UnauthorizedException('This sign-in link is invalid or has expired.');

    return runWithTenant({ labId: lab._id.toString() }, async () => {
      const user = await this.userModel
        .findOne({ email: dto.email.toLowerCase(), role: 'REFERRER', active: true })
        .exec();
      if (!user) throw new UnauthorizedException('This sign-in link is invalid or has expired.');

      const tokenDoc = await this.tokenModel
        .findOne({
          userId: user._id,
          consumedAt: null,
          expiresAt: { $gt: new Date() },
        })
        .sort({ createdAt: -1 })
        .select('+tokenHash +codeHash')
        .exec();
      if (!tokenDoc) {
        throw new UnauthorizedException('This sign-in link is invalid or has expired.');
      }

      const matchesToken = dto.token ? safeEqual(tokenDoc.tokenHash, hashToken(dto.token)) : false;
      const matchesCode = dto.code ? safeEqual(tokenDoc.codeHash, hashToken(dto.code)) : false;
      if (!matchesToken && !matchesCode) {
        tokenDoc.attempts += 1;
        if (tokenDoc.attempts >= 5) tokenDoc.consumedAt = new Date();
        await tokenDoc.save();
        throw new UnauthorizedException('The code is incorrect or has expired.');
      }

      tokenDoc.consumedAt = new Date();
      await tokenDoc.save();
      return this.auth.portalSession(user._id.toString());
    });
  }

  async listCases(
    userId: string,
    email: string,
    page: number,
    limit: number,
  ): Promise<Paginated<PortalCaseSummary>> {
    const filter = {
      $or: [
        { 'referringClinician.referrerUserId': new Types.ObjectId(userId) },
        { 'referringClinician.email': email.toLowerCase() },
      ],
    };
    const [cases, total] = await Promise.all([
      this.caseModel
        .find(filter)
        .sort({ receivedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.caseModel.countDocuments(filter).exec(),
    ]);
    const items = await Promise.all(cases.map((caseDoc) => this.toPortalSummary(caseDoc)));
    return buildPaginated(items, total, page, limit);
  }

  async getCase(caseId: string, userId: string, email: string): Promise<PortalCaseDetail> {
    const caseDoc = await this.findOwnedCase(caseId, userId, email);
    const [patient, report, timeline] = await Promise.all([
      this.patientModel.findById(caseDoc.patientId).exec(),
      this.reportModel.findOne({ caseId: caseDoc._id }).exec(),
      this.custody.forCase(caseDoc._id.toString()),
    ]);
    if (!patient) throw new NotFoundException('Case not found.');
    const summary = await this.toPortalSummary(caseDoc);
    const reportDetail =
      report && report.releasedAt ? await this.assembler.byId(report._id.toString()) : null;
    return {
      ...summary,
      patient: toPatientSummary(patient),
      referringClinician: {
        name: caseDoc.referringClinician.name,
        facility: caseDoc.referringClinician.facility,
        phone: caseDoc.referringClinician.phone,
        email: caseDoc.referringClinician.email,
        referrerUserId: caseDoc.referringClinician.referrerUserId
          ? caseDoc.referringClinician.referrerUserId.toString()
          : null,
      },
      clinicalHistory: caseDoc.clinicalHistory,
      clinicalDiagnosis: caseDoc.clinicalDiagnosis,
      report: reportDetail,
      timeline,
    };
  }

  async getReportPdf(
    caseId: string,
    userId: string,
    email: string,
  ): Promise<{ path: string; filename: string }> {
    await this.findOwnedCase(caseId, userId, email);
    const report = await this.reportModel.findOne({ caseId: new Types.ObjectId(caseId) }).exec();
    if (!report || !report.releasedAt) {
      throw new ForbiddenException('This report has not been released to the referrer yet.');
    }
    return this.pdf.getOrGenerate(report._id.toString());
  }

  private async findOwnedCase(caseId: string, userId: string, email: string): Promise<CaseEntity> {
    const caseDoc = await this.caseModel
      .findOne({
        _id: new Types.ObjectId(caseId),
        $or: [
          { 'referringClinician.referrerUserId': new Types.ObjectId(userId) },
          { 'referringClinician.email': email.toLowerCase() },
        ],
      })
      .exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    return caseDoc;
  }

  private async toPortalSummary(caseDoc: CaseEntity): Promise<PortalCaseSummary> {
    const [patient, report] = await Promise.all([
      this.patientModel.findById(caseDoc.patientId).exec(),
      this.reportModel.findOne({ caseId: caseDoc._id }).exec(),
    ]);
    if (!patient) throw new NotFoundException('Case not found.');
    const released = Boolean(report?.releasedAt);
    const referralStatus = referralStatusFor(caseDoc.status, released, report?.status ?? null);
    return {
      id: caseDoc._id.toString(),
      accessionNumber: caseDoc.accessionNumber,
      status: caseDoc.status,
      referralStatus,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientMrn: patient.mrn,
      receivedAt: caseDoc.receivedAt.toISOString(),
      reportedAt: caseDoc.reportedAt ? caseDoc.reportedAt.toISOString() : null,
      releasedAt: report?.releasedAt ? report.releasedAt.toISOString() : null,
      priority: caseDoc.priority,
      reportAvailable: released,
      downloadUrl: released && report ? `/portal/cases/${caseDoc._id.toString()}/report.pdf` : null,
    };
  }
}

function referralStatusFor(
  caseStatus: CaseStatus,
  released: boolean,
  reportStatus: string | null,
): ReferralStatus {
  if (released) return reportStatus === 'AMENDED' ? 'AMENDED' : 'RELEASED';
  if (caseStatus === 'REPORTED' || caseStatus === 'AMENDED') return 'READY';
  if (caseStatus === 'RECEIVED') return 'RECEIVED';
  return 'IN_PROGRESS';
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

void currentActor;
void toReportDetail;
