import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Model, Types, type Connection } from 'mongoose';
import { randomInt } from 'node:crypto';
import type { Paginated, QaReview, QaStats } from '@lims/shared';
import type { QaDiscrepancyCode, QaSeverity } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { currentActor } from '../../common/utils/actor';
import { buildPaginated } from '../../common/utils/format';
import { AuditService } from '../audit/audit.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { NotificationService } from '../notifications/notification.service';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { ReportModelName, type ReportEntity } from '../reports/report.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';
import { QaReviewModelName, type QaReviewEntity } from './qa-review.schema';
import type {
  AssignQaReviewDto,
  CompleteQaReviewDto,
  CreateQaReviewDto,
  QaQueryDto,
  StartQaReviewDto,
} from './dto/qa.dto';

@Injectable()
export class QaService {
  private readonly logger = new Logger(QaService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(QaReviewModelName) private readonly qaModel: Model<QaReviewEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(ReportModelName) private readonly reportModel: Model<ReportEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  async list(query: QaQueryDto, user: AuthenticatedUser): Promise<Paginated<QaReview>> {
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.reviewerId) filter.reviewerId = new Types.ObjectId(query.reviewerId);
    if (query.mine) filter.reviewerId = new Types.ObjectId(user.id);
    const [docs, total] = await Promise.all([
      this.qaModel
        .find(filter)
        .sort({ status: 1, dueAt: 1, createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      this.qaModel.countDocuments(filter).exec(),
    ]);
    return buildPaginated(
      await Promise.all(docs.map((doc) => this.toDto(doc))),
      total,
      query.page,
      query.limit,
    );
  }

  async stats(user: AuthenticatedUser): Promise<QaStats> {
    const [pending, inReview, agreed, discrepant, overdue, lab] = await Promise.all([
      this.qaModel.countDocuments({ status: 'PENDING' }).exec(),
      this.qaModel.countDocuments({ status: { $in: ['ASSIGNED', 'IN_REVIEW'] } }).exec(),
      this.qaModel.countDocuments({ status: 'AGREED' }).exec(),
      this.qaModel.countDocuments({ status: 'DISCREPANT' }).exec(),
      this.qaModel
        .countDocuments({
          status: { $in: ['PENDING', 'ASSIGNED', 'IN_REVIEW'] },
          dueAt: { $lt: new Date() },
        })
        .exec(),
      this.labModel.findById(user.labId).exec(),
    ]);
    return {
      pending,
      inReview,
      agreed,
      discrepant,
      overdue,
      samplingPercent: lab?.qaSamplingPercent ?? 10,
    };
  }

  async get(id: string): Promise<QaReview> {
    const doc = await this.qaModel.findById(id).exec();
    if (!doc) throw new NotFoundException('QA review not found.');
    return this.toDto(doc);
  }

  async create(dto: CreateQaReviewDto, user: AuthenticatedUser): Promise<QaReview> {
    const caseDoc = await this.caseModel.findById(dto.caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    const report = dto.reportId
      ? await this.reportModel.findOne({ _id: dto.reportId, caseId: caseDoc._id }).exec()
      : await this.reportModel.findOne({ caseId: caseDoc._id }).exec();
    if (dto.reportId && !report) throw new NotFoundException('Report not found.');
    if (report) {
      const existing = await this.qaModel
        .findOne({ reportId: report._id, status: { $in: ['PENDING', 'ASSIGNED', 'IN_REVIEW'] } })
        .exec();
      if (existing)
        throw new ConflictException('An active QA review already exists for this report.');
    }
    const reviewer = dto.reviewerId ? await this.assertReviewer(dto.reviewerId) : null;
    const patient = await this.patientModel.findById(caseDoc.patientId).exec();
    const now = new Date();
    const review = new this.qaModel({
      caseId: caseDoc._id,
      reportId: report?._id ?? null,
      type: dto.type,
      status: reviewer ? 'ASSIGNED' : 'PENDING',
      reason: dto.reason.trim(),
      requestedBy: new Types.ObjectId(user.id),
      reviewerId: reviewer?._id ?? null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : new Date(now.getTime() + 14 * 86_400_000),
      originalDiagnosis: report ? diagnosisFrom(report) : caseDoc.clinicalDiagnosis,
      metadata: { patientName: patient ? `${patient.firstName} ${patient.lastName}` : null },
    });
    await review.save();
    await this.audit.record({
      action: 'QA',
      entityType: 'QaReview',
      entityId: review._id.toString(),
      caseId: caseDoc._id.toString(),
      after: { type: review.type, status: review.status, reviewerId: reviewer?._id.toString() },
      metadata: { reason: review.reason },
    });
    if (reviewer && reviewer._id.toString() !== user.id) {
      await this.notifyReviewer(review, reviewer);
    }
    return this.toDto(review);
  }

  async assign(id: string, dto: AssignQaReviewDto, user: AuthenticatedUser): Promise<QaReview> {
    const reviewer = await this.assertReviewer(dto.reviewerId);
    const review = await this.qaModel.findById(id).exec();
    if (!review) throw new NotFoundException('QA review not found.');
    if (review.status === 'CLOSED' || review.status === 'CANCELLED') {
      throw new ConflictException('A closed QA review cannot be reassigned.');
    }
    review.reviewerId = reviewer._id;
    review.status = review.status === 'PENDING' ? 'ASSIGNED' : review.status;
    if (dto.dueAt) review.dueAt = new Date(dto.dueAt);
    await review.save();
    await this.audit.record({
      action: 'QA',
      entityType: 'QaReview',
      entityId: review._id.toString(),
      caseId: review.caseId.toString(),
      after: { reviewerId: reviewer._id.toString(), status: review.status },
      metadata: { event: 'assigned', by: user.email },
    });
    await this.notifyReviewer(review, reviewer);
    return this.toDto(review);
  }

  async start(id: string, dto: StartQaReviewDto, user: AuthenticatedUser): Promise<QaReview> {
    const review = await this.qaModel.findById(id).exec();
    if (!review) throw new NotFoundException('QA review not found.');
    if (
      review.reviewerId?.toString() !== user.id &&
      user.role !== 'LAB_ADMIN' &&
      user.role !== 'SUPER_ADMIN'
    ) {
      throw new BadRequestException('Only the assigned reviewer can start this QA review.');
    }
    if (review.status === 'PENDING') {
      review.reviewerId = new Types.ObjectId(user.id);
    }
    review.status = 'IN_REVIEW';
    review.startedAt = review.startedAt ?? new Date();
    if (dto.findings) review.findings = dto.findings.trim();
    await review.save();
    await this.audit.record({
      action: 'QA',
      entityType: 'QaReview',
      entityId: review._id.toString(),
      caseId: review.caseId.toString(),
      after: { status: review.status, reviewerId: review.reviewerId?.toString() },
      metadata: { event: 'started' },
    });
    return this.toDto(review);
  }

  async complete(id: string, dto: CompleteQaReviewDto, user: AuthenticatedUser): Promise<QaReview> {
    const review = await this.qaModel.findById(id).exec();
    if (!review) throw new NotFoundException('QA review not found.');
    if (
      review.reviewerId?.toString() !== user.id &&
      user.role !== 'LAB_ADMIN' &&
      user.role !== 'SUPER_ADMIN'
    ) {
      throw new BadRequestException('Only the assigned reviewer can complete this QA review.');
    }
    if (dto.outcome === 'DISCREPANT' && !dto.disagreementCode) {
      throw new BadRequestException('Select a discrepancy code when the review disagrees.');
    }
    if (dto.outcome === 'DISCREPANT' && !dto.severity) {
      throw new BadRequestException('Set a severity for the discrepancy.');
    }
    review.status = dto.outcome;
    review.reviewDiagnosis = dto.reviewDiagnosis?.trim() || null;
    review.discrepancyCode = (dto.disagreementCode as QaDiscrepancyCode | undefined) ?? null;
    review.severity = (dto.severity as QaSeverity | undefined) ?? null;
    review.findings = dto.findings.trim();
    review.actionPlan = dto.actionPlan?.trim() || null;
    review.completedAt = new Date();
    await review.save();
    await this.audit.record({
      action: 'QA',
      entityType: 'QaReview',
      entityId: review._id.toString(),
      caseId: review.caseId.toString(),
      after: {
        status: review.status,
        discrepancyCode: review.discrepancyCode,
        severity: review.severity,
      },
      metadata: { findings: review.findings },
    });
    await this.notifications.send({
      labId: user.labId,
      type: dto.outcome === 'DISCREPANT' ? 'QA_DISCREPANCY' : 'QA_AGREED',
      title: dto.outcome === 'DISCREPANT' ? 'QA discrepancy recorded' : 'Peer review agreed',
      body:
        dto.outcome === 'DISCREPANT'
          ? `A ${dto.severity?.toLowerCase()} discrepancy (${dto.disagreementCode}) was recorded for a peer review.`
          : 'A peer review was completed with agreement.',
      caseId: review.caseId.toString(),
      entityType: 'QaReview',
      entityId: review._id.toString(),
      role: 'LAB_ADMIN',
    });
    return this.toDto(review);
  }

  async maybeCreatePeerReview(reportId: string, user: AuthenticatedUser): Promise<QaReview | null> {
    try {
      const report = await this.reportModel.findById(reportId).exec();
      if (!report) return null;
      const lab = await this.labModel.findById(user.labId).exec();
      const percent = lab?.qaSamplingPercent ?? 10;
      if (percent <= 0) return null;
      if (randomInt(0, 100) >= percent) return null;
      const existing = await this.qaModel
        .findOne({ reportId: report._id, status: { $in: ['PENDING', 'ASSIGNED', 'IN_REVIEW'] } })
        .exec();
      if (existing) return null;
      const caseDoc = await this.caseModel.findById(report.caseId).exec();
      if (!caseDoc) return null;
      const reviewers = await this.userModel
        .find({ role: 'PATHOLOGIST', active: true, _id: { $ne: new Types.ObjectId(user.id) } })
        .exec();
      const reviewer = reviewers.length > 0 ? reviewers[randomInt(0, reviewers.length)] : null;
      const patient = await this.patientModel.findById(caseDoc.patientId).exec();
      const review = new this.qaModel({
        caseId: report.caseId,
        reportId: report._id,
        type: 'PEER_REVIEW',
        status: reviewer ? 'ASSIGNED' : 'PENDING',
        reason: `Random ${percent}% peer-review sample`,
        requestedBy: new Types.ObjectId(user.id),
        reviewerId: reviewer?._id ?? null,
        dueAt: new Date(Date.now() + 14 * 86_400_000),
        originalDiagnosis: diagnosisFrom(report),
        metadata: {
          patientName: patient ? `${patient.firstName} ${patient.lastName}` : null,
          sampled: true,
        },
      });
      await review.save();
      await this.audit.record({
        action: 'QA',
        entityType: 'QaReview',
        entityId: review._id.toString(),
        caseId: report.caseId.toString(),
        after: { type: review.type, status: review.status, sampled: true },
        metadata: { samplingPercent: percent },
      });
      if (reviewer) await this.notifyReviewer(review, reviewer);
      return this.toDto(review);
    } catch (error) {
      this.logger.warn({ err: error, reportId }, 'Could not create a sampled peer review.');
      return null;
    }
  }

  private async assertReviewer(id: string): Promise<UserEntity> {
    const reviewer = await this.userModel.findById(id).exec();
    if (!reviewer || !reviewer.active || reviewer.role !== 'PATHOLOGIST') {
      throw new BadRequestException('Select an active pathologist as the reviewer.');
    }
    return reviewer;
  }

  private async notifyReviewer(review: QaReviewEntity, reviewer: UserEntity): Promise<void> {
    await this.notifications.send({
      labId: review.labId.toString(),
      type: 'QA_ASSIGNED',
      title: 'QA review assigned',
      body: `A ${review.type.replace('_', ' ').toLowerCase()} is waiting for your review. Due ${review.dueAt?.toISOString().slice(0, 10) ?? 'soon'}.`,
      caseId: review.caseId.toString(),
      entityType: 'QaReview',
      entityId: review._id.toString(),
      userId: reviewer._id.toString(),
      channels: ['IN_APP', ...(reviewer.email ? (['EMAIL'] as const) : [])],
      recipient: { email: reviewer.email, name: reviewer.name },
    });
  }

  private async toDto(doc: QaReviewEntity): Promise<QaReview> {
    const [caseDoc, patient, report, requester, reviewer] = await Promise.all([
      this.caseModel.findById(doc.caseId).exec(),
      this.caseModel
        .findById(doc.caseId)
        .exec()
        .then((item) => (item ? this.patientModel.findById(item.patientId).exec() : null)),
      doc.reportId ? this.reportModel.findById(doc.reportId).exec() : null,
      doc.requestedBy ? this.userModel.findById(doc.requestedBy).exec() : null,
      doc.reviewerId ? this.userModel.findById(doc.reviewerId).exec() : null,
    ]);
    return {
      id: doc._id.toString(),
      caseId: doc.caseId.toString(),
      accessionNumber: caseDoc?.accessionNumber ?? '—',
      patientName: patient ? `${patient.firstName} ${patient.lastName}` : '—',
      reportId: doc.reportId ? doc.reportId.toString() : null,
      protocolTitle: report?.protocolSnapshot.title ?? null,
      type: doc.type,
      status: doc.status,
      reason: doc.reason,
      requestedBy: requester ? this.userSummary(requester) : null,
      reviewer: reviewer ? this.userSummary(reviewer) : null,
      dueAt: doc.dueAt ? doc.dueAt.toISOString() : null,
      originalDiagnosis: doc.originalDiagnosis,
      reviewDiagnosis: doc.reviewDiagnosis,
      discrepancyCode: doc.discrepancyCode,
      severity: doc.severity,
      findings: doc.findings,
      actionPlan: doc.actionPlan,
      completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  private userSummary(user: UserEntity) {
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      subspecialties: user.subspecialties,
    };
  }
}

function diagnosisFrom(report: ReportEntity): string | null {
  for (const key of ['finalDiagnosis', 'diagnosis', 'histologicType', 'tumourType']) {
    const value = report.data[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return report.narrative.slice(0, 600) || null;
}

void currentActor;
