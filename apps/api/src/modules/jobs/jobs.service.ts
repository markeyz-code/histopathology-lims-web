import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { PdfJobResult } from '@lims/shared';
import { runWithTenant } from '../../common/context/tenant-context';
import {
  NotificationService,
  type NotificationPayload,
} from '../notifications/notification.service';
import { InventoryService } from '../inventory/inventory.service';
import { PdfService } from '../pdf/pdf.service';
import { TatCheckService } from './tat-check.service';

function redisConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const dbSegment = parsed.pathname.replace(/^\//, '');
  const db = dbSegment ? Number(dbSegment) : undefined;
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isFinite(db) ? db : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly enabled: boolean;
  private pdfQueue?: Queue;
  private notificationsQueue?: Queue;
  private maintenanceQueue?: Queue;
  private pdfWorker?: Worker;
  private notificationsWorker?: Worker;
  private maintenanceWorker?: Worker;

  constructor(
    private readonly config: ConfigService,
    private readonly pdfService: PdfService,
    private readonly tatCheck: TatCheckService,
    private readonly notifications: NotificationService,
    private readonly inventory: InventoryService,
  ) {
    this.enabled = config.get<boolean>('QUEUES_ENABLED') ?? true;
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.warn('Queues disabled (QUEUES_ENABLED=false). PDF and notifications run inline.');
      return;
    }
    let connection: ConnectionOptions;
    try {
      connection = redisConnection(this.config.getOrThrow<string>('REDIS_URL'));
    } catch (error) {
      this.logger.error({ err: error }, 'Invalid REDIS_URL; background jobs are disabled.');
      return;
    }

    this.pdfQueue = new Queue('lims-reports', { connection });
    this.notificationsQueue = new Queue('lims-notifications', { connection });
    this.maintenanceQueue = new Queue('lims-maintenance', { connection });

    this.pdfWorker = new Worker(
      'lims-reports',
      async (job) => {
        if (job.name !== 'generate-pdf') return;
        await runWithTenant({ labId: String(job.data.labId) }, () =>
          this.pdfService.generateAndStore(String(job.data.reportId)),
        );
      },
      { connection, concurrency: 2 },
    );

    this.notificationsWorker = new Worker(
      'lims-notifications',
      async (job) => {
        await runWithTenant({ labId: String(job.data.labId) }, () =>
          this.notifications.send(job.data as NotificationPayload),
        );
      },
      { connection, concurrency: 4 },
    );

    this.maintenanceWorker = new Worker(
      'lims-maintenance',
      async (job) => {
        if (job.name === 'tat-check') {
          const count = await this.tatCheck.runAllLabs();
          this.logger.log(`TAT breach check completed; ${count} cases flagged.`);
        }
        if (job.name === 'inventory-expiry') {
          const count = await this.inventory.runExpiryChecks();
          this.logger.log(`Inventory expiry check completed; ${count} lots expired.`);
        }
      },
      { connection, concurrency: 1 },
    );

    for (const worker of [this.pdfWorker, this.notificationsWorker, this.maintenanceWorker]) {
      worker.on('failed', (job, error) => {
        this.logger.error(
          { err: error, queue: worker.name, jobId: job?.id, jobName: job?.name },
          'Background job failed',
        );
      });
    }

    void this.maintenanceQueue
      .upsertJobScheduler(
        'tat-checks-15m',
        { every: 15 * 60 * 1_000 },
        { name: 'tat-check', data: {} },
      )
      .catch((error: unknown) => {
        this.logger.error({ err: error }, 'Could not register the recurring TAT check.');
      });

    void this.maintenanceQueue
      .upsertJobScheduler(
        'inventory-expiry-daily',
        { every: 24 * 60 * 60 * 1_000 },
        { name: 'inventory-expiry', data: {} },
      )
      .catch((error: unknown) => {
        this.logger.error({ err: error }, 'Could not register the inventory expiry check.');
      });
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      this.pdfWorker?.close(),
      this.notificationsWorker?.close(),
      this.maintenanceWorker?.close(),
      this.pdfQueue?.close(),
      this.notificationsQueue?.close(),
      this.maintenanceQueue?.close(),
    ]);
  }

  async enqueuePdf(reportId: string, labId: string, version: number): Promise<PdfJobResult> {
    if (!this.enabled || !this.pdfQueue) {
      await runWithTenant({ labId }, () => this.pdfService.generateAndStore(reportId));
      return { queued: false, reportId, version };
    }
    try {
      await this.pdfQueue.add(
        'generate-pdf',
        { reportId, labId, version },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
      return { queued: true, reportId, version };
    } catch (error) {
      this.logger.error({ err: error }, 'PDF queue unavailable; generating inline.');
      await runWithTenant({ labId }, () => this.pdfService.generateAndStore(reportId));
      return { queued: false, reportId, version };
    }
  }

  async enqueueNotification(payload: NotificationPayload): Promise<void> {
    if (!this.enabled || !this.notificationsQueue) {
      await runWithTenant({ labId: payload.labId }, () => this.notifications.send(payload));
      return;
    }
    try {
      await this.notificationsQueue.add('notify', payload, {
        attempts: 3,
        removeOnComplete: 200,
        removeOnFail: 200,
      });
    } catch (error) {
      this.logger.error({ err: error }, 'Notification queue unavailable; writing inline.');
      await runWithTenant({ labId: payload.labId }, () => this.notifications.send(payload));
    }
  }
}
