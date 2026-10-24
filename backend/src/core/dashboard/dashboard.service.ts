import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  CASE_STATUSES,
  PRIORITIES,
  type CaseStatus,
  type DashboardAlert,
  type DashboardSummary,
  type Priority,
  type StageTat,
  type WorkloadRow,
} from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { startOfDay } from '../../common/utils/format';
import { CasesService } from '../cases/cases.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { CustodyEventModelName, type CustodyEventEntity } from '../custody/custody-event.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';

interface GroupCount<T> {
  _id: T;
  count: number;
}

interface WorkloadAggregate {
  _id: Types.ObjectId | null;
  active: number;
  pending: number;
  reported: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectModel(CustodyEventModelName)
    private readonly eventModel: Model<CustodyEventEntity>,
    private readonly casesService: CasesService,
  ) {}

  async getSummary(query: { days?: number }, _user: AuthenticatedUser): Promise<DashboardSummary> {
    const days = query.days ?? 30;
    const now = new Date();
    const rangeStart = new Date(now.getTime() - days * 86_400_000);
    const today = startOfDay(now);
    const activeStatuses: CaseStatus[] = ['RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW'];

    const [
      totalCases,
      active,
      overdue,
      reportedInRange,
      reportedToday,
      statusGroups,
      priorityGroups,
      avgTatAgg,
      recentRaw,
      overdueCases,
      workloadAgg,
      pathologists,
      casesInRange,
    ] = await Promise.all([
      this.caseModel.countDocuments({}).exec(),
      this.caseModel.countDocuments({ status: { $in: activeStatuses } }).exec(),
      this.caseModel
        .countDocuments({ status: { $in: activeStatuses }, tatDeadline: { $lt: now } })
        .exec(),
      this.caseModel.countDocuments({ reportedAt: { $gte: rangeStart } }).exec(),
      this.caseModel.countDocuments({ reportedAt: { $gte: today } }).exec(),
      this.caseModel
        .aggregate<GroupCount<CaseStatus>>([{ $group: { _id: '$status', count: { $sum: 1 } } }])
        .exec(),
      this.caseModel
        .aggregate<GroupCount<Priority>>([{ $group: { _id: '$priority', count: { $sum: 1 } } }])
        .exec(),
      this.caseModel
        .aggregate<{ _id: null; average: number; count: number }>([
          {
            $match: {
              reportedAt: { $gte: rangeStart, $ne: null },
              status: { $in: ['REPORTED', 'AMENDED'] },
            },
          },
          {
            $project: {
              hours: {
                $divide: [{ $subtract: ['$reportedAt', '$receivedAt'] }, 3_600_000],
              },
            },
          },
          { $group: { _id: null, average: { $avg: '$hours' }, count: { $sum: 1 } } },
        ])
        .exec(),
      this.caseModel.find({}).sort({ receivedAt: -1 }).limit(8).exec(),
      this.caseModel
        .find({ status: { $in: activeStatuses }, tatDeadline: { $lt: now } })
        .sort({ tatDeadline: 1 })
        .limit(8)
        .exec(),
      this.caseModel
        .aggregate<WorkloadAggregate>([
          { $match: { status: { $in: ['IN_PROGRESS', 'PENDING_REVIEW'] } } },
          {
            $group: {
              _id: '$assignedPathologistId',
              active: { $sum: 1 },
              pending: {
                $sum: { $cond: [{ $eq: ['$status', 'PENDING_REVIEW'] }, 1, 0] },
              },
              reported: { $sum: 0 },
            },
          },
        ])
        .exec(),
      this.userModel.find({ role: 'PATHOLOGIST', active: true }).sort({ name: 1 }).exec(),
      this.caseModel
        .find({ receivedAt: { $gte: rangeStart } })
        .select('_id receivedAt')
        .limit(2_000)
        .exec(),
    ]);

    const stageTat = await this.computeStageTat(
      casesInRange.map((item) => ({ id: item._id, receivedAt: item.receivedAt })),
    );

    const workload = await this.computeWorkload(workloadAgg, pathologists, rangeStart);
    const recentCases = await this.casesService.decorateCases(recentRaw);
    const alerts = await this.buildAlerts(overdueCases, now);

    const statusMap = new Map(statusGroups.map((group) => [group._id, group.count]));
    const priorityMap = new Map(priorityGroups.map((group) => [group._id, group.count]));

    return {
      generatedAt: now.toISOString(),
      rangeDays: days,
      totals: {
        cases: totalCases,
        active,
        overdue,
        reportedInRange,
        reportedToday,
        averageTatHours:
          avgTatAgg[0]?.average !== undefined ? Math.round(avgTatAgg[0].average * 10) / 10 : null,
      },
      casesByStatus: CASE_STATUSES.map((status) => ({
        status,
        count: statusMap.get(status) ?? 0,
      })),
      casesByPriority: PRIORITIES.map((priority) => ({
        priority,
        count: priorityMap.get(priority) ?? 0,
      })),
      stageTat,
      workload,
      recentCases,
      alerts,
    };
  }

  private async computeStageTat(
    cases: { id: Types.ObjectId; receivedAt: Date }[],
  ): Promise<StageTat[]> {
    if (cases.length === 0) return this.emptyStageTat();
    const caseIds = cases.map((item) => item.id);
    const events = await this.eventModel
      .find({
        caseId: { $in: caseIds },
        toState: {
          $in: [
            'GROSSED',
            'PROCESSING',
            'EMBEDDED',
            'CUT',
            'STAINED',
            'WITH_PATHOLOGIST',
            'REPORTED',
          ],
        },
      })
      .select('caseId toState timestamp')
      .sort({ timestamp: 1 })
      .exec();

    const milestones = new Map<string, Map<string, Date>>();
    for (const event of events) {
      if (!event.caseId) continue;
      const key = event.caseId.toString();
      const perCase = milestones.get(key) ?? new Map<string, Date>();
      if (!perCase.has(event.toState)) perCase.set(event.toState, event.timestamp);
      milestones.set(key, perCase);
    }

    const stageDefs: {
      key: string;
      label: string;
      from: string;
      to: string;
      fromCase?: boolean;
    }[] = [
      {
        key: 'grossing',
        label: 'Accession → grossing',
        from: 'RECEIVED',
        to: 'GROSSED',
        fromCase: true,
      },
      { key: 'processing', label: 'Processing', from: 'GROSSED', to: 'PROCESSING' },
      { key: 'embedding', label: 'Embedding', from: 'PROCESSING', to: 'EMBEDDED' },
      { key: 'microtomy', label: 'Microtomy', from: 'EMBEDDED', to: 'CUT' },
      { key: 'staining', label: 'Staining', from: 'CUT', to: 'STAINED' },
      { key: 'pathologist', label: 'Pathologist desk', from: 'STAINED', to: 'WITH_PATHOLOGIST' },
      { key: 'reporting', label: 'Reporting', from: 'WITH_PATHOLOGIST', to: 'REPORTED' },
    ];

    return stageDefs.map((stage) => {
      const durations: number[] = [];
      for (const caseItem of cases) {
        const perCase = milestones.get(caseItem.id.toString());
        if (!perCase) continue;
        const from = stage.fromCase ? caseItem.receivedAt : perCase.get(stage.from);
        const to = perCase.get(stage.to);
        if (from && to) {
          const hours = (to.getTime() - from.getTime()) / 3_600_000;
          if (hours >= 0) durations.push(hours);
        }
      }
      const average =
        durations.length > 0
          ? Math.round((durations.reduce((sum, value) => sum + value, 0) / durations.length) * 10) /
            10
          : null;
      return {
        key: stage.key,
        label: stage.label,
        averageHours: average,
        samples: durations.length,
      };
    });
  }

  private emptyStageTat(): StageTat[] {
    return [
      { key: 'grossing', label: 'Accession → grossing', averageHours: null, samples: 0 },
      { key: 'processing', label: 'Processing', averageHours: null, samples: 0 },
      { key: 'embedding', label: 'Embedding', averageHours: null, samples: 0 },
      { key: 'microtomy', label: 'Microtomy', averageHours: null, samples: 0 },
      { key: 'staining', label: 'Staining', averageHours: null, samples: 0 },
      { key: 'pathologist', label: 'Pathologist desk', averageHours: null, samples: 0 },
      { key: 'reporting', label: 'Reporting', averageHours: null, samples: 0 },
    ];
  }

  private async computeWorkload(
    aggregate: WorkloadAggregate[],
    pathologists: UserEntity[],
    rangeStart: Date,
  ): Promise<WorkloadRow[]> {
    const reportedAgg = await this.caseModel
      .aggregate<WorkloadAggregate>([
        {
          $match: {
            assignedPathologistId: { $ne: null },
            reportedAt: { $gte: rangeStart },
          },
        },
        {
          $group: {
            _id: '$assignedPathologistId',
            reported: { $sum: 1 },
            active: { $sum: 0 },
            pending: { $sum: 0 },
          },
        },
      ])
      .exec();

    const reportedMap = new Map(
      reportedAgg
        .filter((item) => item._id)
        .map((item) => [item._id?.toString() ?? '', item.reported]),
    );
    const activeMap = new Map(
      aggregate
        .filter((item) => item._id)
        .map((item) => [
          item._id?.toString() ?? '',
          { active: item.active, pending: item.pending },
        ]),
    );

    return pathologists.map((user) => {
      const counts = activeMap.get(user._id.toString()) ?? { active: 0, pending: 0 };
      return {
        pathologistId: user._id.toString(),
        name: user.name,
        activeCases: counts.active,
        pendingReview: counts.pending,
        reportedInRange: reportedMap.get(user._id.toString()) ?? 0,
      };
    });
  }

  private async buildAlerts(cases: CaseEntity[], now: Date): Promise<DashboardAlert[]> {
    if (cases.length === 0) return [];
    const patients = await this.patientModel
      .find({ _id: { $in: cases.map((item) => item.patientId) } })
      .exec();
    const patientMap = new Map(patients.map((patient) => [patient._id.toString(), patient]));
    return cases.map((caseDoc) => {
      const patient = patientMap.get(caseDoc.patientId.toString());
      return {
        caseId: caseDoc._id.toString(),
        accessionNumber: caseDoc.accessionNumber,
        patientName: patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown patient',
        priority: caseDoc.priority,
        tatDeadline: caseDoc.tatDeadline.toISOString(),
        hoursOverdue:
          Math.round(((now.getTime() - caseDoc.tatDeadline.getTime()) / 3_600_000) * 10) / 10,
      };
    });
  }
}
