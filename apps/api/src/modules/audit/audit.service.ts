import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type ClientSession } from 'mongoose';
import type { AuditAction, Paginated } from '@lims/shared';
import { currentTenant } from '../../common/context/tenant-context';
import { currentActor, requestAuditContext } from '../../common/utils/actor';
import { auditSnapshot, buildPaginated, parseDateOnly } from '../../common/utils/format';
import { toAuditLog } from '../../common/serializers/entities';
import { AuditLogModelName, type AuditLogEntity } from './audit-log.schema';
import type { AuditListQueryDto } from './dto/audit-list-query.dto';

export interface AuditRecordInput {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  caseId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  actor?: { userId: string | null; userName: string; userRole: string | null };
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLogModelName)
    private readonly auditModel: Model<AuditLogEntity>,
  ) {}

  /**
   * Append an audit record. Pass the caller's transaction session so the audit
   * entry commits (or rolls back) with the business change it describes.
   */
  async record(input: AuditRecordInput, session?: ClientSession): Promise<void> {
    const tenant = currentTenant();
    if (!tenant) return;

    const actor = input.actor ?? currentActor();
    const context = requestAuditContext();
    const doc = new this.auditModel({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      caseId: input.caseId ?? null,
      userId: actor.userId ? new Types.ObjectId(actor.userId) : null,
      userName: actor.userName,
      userRole: actor.userRole ?? null,
      before: auditSnapshot(input.before),
      after: auditSnapshot(input.after),
      metadata: input.metadata ?? {},
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
    await doc.save(session ? { session } : {});
  }

  async list(query: AuditListQueryDto): Promise<Paginated<ReturnType<typeof toAuditLog>>> {
    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.userId) filter.userId = new Types.ObjectId(query.userId);
    if (query.from || query.to) {
      const range: Record<string, Date> = {};
      if (query.from) {
        const from = parseDateOnly(query.from);
        if (from) range.$gte = from;
      }
      if (query.to) {
        const to = parseDateOnly(query.to);
        if (to) {
          to.setUTCHours(23, 59, 59, 999);
          range.$lte = to;
        }
      }
      if (Object.keys(range).length > 0) filter.createdAt = range;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [documents, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return buildPaginated(
      documents.map((document) => toAuditLog(document)),
      total,
      page,
      limit,
    );
  }
}
