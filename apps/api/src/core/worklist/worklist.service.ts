import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { computeTat, type WorklistItem, type WorklistResult } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CasesService } from '../cases/cases.service';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { LabsService } from '../labs/labs.service';
import { TestRequestsService } from '../test-requests/test-requests.service';
import { CaseArtifactRegistry, type WorklistMetrics } from '../cases/case-artifacts';
import type { WorklistQueryDto } from './dto/worklist-query.dto';

@Injectable()
export class WorklistService {
  constructor(
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    private readonly artifacts: CaseArtifactRegistry,
    private readonly casesService: CasesService,
    private readonly testRequests: TestRequestsService,
    private readonly labsService: LabsService,
  ) {}

  async getWorklist(query: WorklistQueryDto, user: AuthenticatedUser): Promise<WorklistResult> {
    const assigned = query.assigned ?? 'all';
    const limit = query.limit ?? 50;
    const activeStatuses = query.status
      ? [query.status]
      : (['RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW'] as const);
    const filter: Record<string, unknown> = {
      status: query.status ?? { $in: [...activeStatuses] },
    };
    if (query.priority) filter.priority = query.priority;
    if (query.subspecialty) filter.subspecialty = query.subspecialty;
    if (query.pathologistId) {
      filter.assignedPathologistId = new Types.ObjectId(query.pathologistId);
    }
    if (query.discipline) {
      const caseIds = await this.testRequests.caseIdsForDiscipline(query.discipline);
      filter._id = { $in: caseIds };
    }
    if (assigned === 'me') {
      filter.assignedPathologistId = new Types.ObjectId(user.id);
    } else if (assigned === 'unassigned') {
      filter.assignedPathologistId = null;
    }

    const [cases, total, lab] = await Promise.all([
      this.caseModel
        .find(filter)
        .sort({ priorityRank: 1, tatDeadline: 1, receivedAt: 1 })
        .limit(limit)
        .exec(),
      this.caseModel.countDocuments(filter).exec(),
      this.labsService.getById(user.labId),
    ]);

    const decorated = await this.casesService.decorateCases(cases);
    const caseIds = cases.map((caseDoc) => caseDoc._id);
    const requestMap = await this.testRequests.forCases(caseIds);
    const counts: Map<string, WorklistMetrics> = await this.artifacts.metrics(
      'HISTOPATHOLOGY',
      caseIds.map((id) => id.toString()),
    );

    const items: WorklistItem[] = decorated.map((caseItem, index) => {
      const caseDoc = cases[index];
      if (!caseDoc) throw new Error('Case decoration lost ordering.');
      const count = counts.get(caseItem.id) ?? { total: 0, pending: 0, stained: 0 };
      return {
        case: caseItem,
        testRequests: requestMap.get(caseItem.id) ?? [],
        totalSlides: count.total,
        pendingSlides: count.pending,
        stainedSlides: count.stained,
        reportStatus: caseItem.report?.status ?? null,
        tat: computeTat(caseDoc.receivedAt, caseDoc.tatDeadline, {
          warningPercent: lab.tatWarningPercent,
          done: Boolean(caseItem.report?.signedOutAt),
        }),
      };
    });

    return {
      items,
      total,
      generatedAt: new Date().toISOString(),
      summary: {
        frozen: items.filter((item) => item.case.priority === 'FROZEN').length,
        urgent: items.filter((item) => item.case.priority === 'URGENT').length,
        overdue: items.filter((item) => item.tat.state === 'BREACHED').length,
        awaitingReview: items.filter((item) => item.pendingSlides > 0).length,
      },
    };
  }
}
