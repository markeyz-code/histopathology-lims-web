import { BadRequestException, Injectable } from '@nestjs/common';
import { scanIdempotencySchema, type SyncBatchResult, type SyncMutationResult } from '@lims/shared';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { CustodyPortRegistry } from '../../core/custody/custody-ports';
import type { SyncBatchDto, SyncMutationDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly custody: CustodyPortRegistry,
    private readonly idempotency: IdempotencyService,
  ) {}

  async batch(dto: SyncBatchDto): Promise<SyncBatchResult> {
    const results: SyncMutationResult[] = [];
    for (const mutation of dto.mutations) {
      results.push(await this.apply(mutation));
    }
    return { results, syncedAt: new Date().toISOString() };
  }

  private async apply(mutation: SyncMutationDto): Promise<SyncMutationResult> {
    try {
      if (mutation.type !== 'SCAN' && mutation.type !== 'REJECT' && mutation.type !== 'RECUT') {
        throw new BadRequestException('This mutation type is not supported by the sync endpoint.');
      }
      const parsed = scanIdempotencySchema.safeParse(mutation.payload);
      if (!parsed.success) {
        throw new BadRequestException(
          parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        );
      }
      const payload = parsed.data;
      const scanInput = {
        barcode: payload.barcode,
        station: payload.station,
        eventType:
          mutation.type === 'REJECT'
            ? ('REJECTED' as const)
            : mutation.type === 'RECUT'
              ? ('RECUT_REQUESTED' as const)
              : payload.eventType,
        reason: payload.reason,
        reasonCode: payload.reasonCode,
        metadata: { ...(payload.metadata ?? {}), sync: true, clientId: mutation.id },
      };
      const outcome = await this.idempotency.run(
        mutation.id,
        this.idempotency.hash({ type: mutation.type, payload }),
        'sync-mutation',
        () => this.custody.scanHandler!.scan(scanInput),
      );
      return {
        id: mutation.id,
        ok: true,
        duplicate: outcome.duplicate,
        result: outcome.value as unknown as Record<string, unknown>,
        error: null,
      };
    } catch (error) {
      return {
        id: mutation.id,
        ok: false,
        duplicate: false,
        result: null,
        error: error instanceof Error ? error.message : 'Sync failed.',
      };
    }
  }
}
