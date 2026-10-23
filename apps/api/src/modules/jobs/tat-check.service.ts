import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { currentTenant } from '../../common/context/tenant-context';
import { runWithTenant } from '../../common/context/tenant-context';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import {
  NotificationModelName,
  type NotificationEntity,
} from '../notifications/notification.schema';

@Injectable()
export class TatCheckService {
  private readonly logger = new Logger(TatCheckService.name);

  constructor(
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(NotificationModelName)
    private readonly notificationModel: Model<NotificationEntity>,
  ) {}

  async runAllLabs(): Promise<number> {
    const labs = await this.labModel.find({ active: true }).select('_id').exec();
    let total = 0;
    for (const lab of labs) {
      total += await runWithTenant({ labId: lab._id.toString() }, () => this.checkLab());
    }
    return total;
  }

  async runCurrentLab(): Promise<number> {
    const tenant = currentTenant();
    if (!tenant) return 0;
    return this.checkLab();
  }

  private async checkLab(): Promise<number> {
    const now = new Date();
    const cases = await this.caseModel
      .find({
        status: { $in: ['RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW'] },
        tatDeadline: { $lt: now },
        tatBreachedAt: null,
      })
      .limit(500)
      .exec();

    for (const caseDoc of cases) {
      await this.caseModel.updateOne({ _id: caseDoc._id }, { $set: { tatBreachedAt: now } }).exec();
      const overdueHours =
        Math.round(((now.getTime() - caseDoc.tatDeadline.getTime()) / 3_600_000) * 10) / 10;
      const notification = new this.notificationModel({
        type: 'TAT_BREACH',
        title: `TAT breach — ${caseDoc.accessionNumber}`,
        body: `The ${caseDoc.priority.toLowerCase()} case ${caseDoc.accessionNumber} is ${overdueHours}h beyond its ${caseDoc.tatDeadline.toISOString()} turnaround deadline.`,
        caseId: caseDoc._id.toString(),
        entityType: 'Case',
        entityId: caseDoc._id.toString(),
        userId: caseDoc.assignedPathologistId ?? null,
        role: caseDoc.assignedPathologistId ? null : 'LAB_ADMIN',
        readAt: null,
        metadata: { overdueHours, priority: caseDoc.priority },
      });
      await notification.save();
    }

    if (cases.length > 0) {
      this.logger.warn(`Flagged ${cases.length} TAT breaches.`);
    }
    return cases.length;
  }
}

void Types;
