import { Injectable, OnModuleInit } from '@nestjs/common';
import { Types, type ClientSession } from 'mongoose';
import { CustodyPortRegistry } from '../../../core/custody/custody-ports';
import { ReportPortRegistry } from '../../../core/reports/report-ports';
import type { Actor } from '../../../common/utils/actor';
import { LocatorService } from './locator.service';
import { ReportPropagationService } from './report-propagation.service';
import { ScanService } from './scan.service';

@Injectable()
export class HistopathologyCustodyPortsService implements OnModuleInit {
  constructor(
    private readonly scanService: ScanService,
    private readonly locatorService: LocatorService,
    private readonly propagation: ReportPropagationService,
    private readonly custodyPorts: CustodyPortRegistry,
    private readonly reportPorts: ReportPortRegistry,
  ) {}

  onModuleInit(): void {
    this.custodyPorts.register({
      scan: { scan: (dto) => this.scanService.scan(dto) },
      locator: {
        locate: (barcode) => this.locatorService.locate(barcode),
        caseTimeline: (caseId) => this.locatorService.caseTimeline(caseId),
        entityTimeline: (entityType, entityId) =>
          this.locatorService.entityTimeline(entityType, entityId),
      },
    });
    this.reportPorts.register('HISTOPATHOLOGY', {
      finalizer: {
        markReported: async (caseId: string, actor: Actor, session: ClientSession) => {
          await this.propagation.markReported(new Types.ObjectId(caseId), actor, session);
        },
      },
    });
  }
}
