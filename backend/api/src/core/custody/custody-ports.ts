import { Global, Injectable, Module } from '@nestjs/common';
import type { CustodyEvent, LocatorResult, ScanResponse } from '@lims/shared';
import type { ScanDto } from './dto/scan.dto';

export interface ScanHandler {
  scan(dto: ScanDto): Promise<ScanResponse>;
}

export interface LocatorHandler {
  locate(barcode: string): Promise<LocatorResult>;
  caseTimeline(caseId: string): Promise<CustodyEvent[]>;
  entityTimeline(entityType: string, entityId: string): Promise<CustodyEvent[]>;
}

@Injectable()
export class CustodyPortRegistry {
  scanHandler: ScanHandler | null = null;
  locatorHandler: LocatorHandler | null = null;

  register(handler: { scan?: ScanHandler; locator?: LocatorHandler }): void {
    if (handler.scan) this.scanHandler = handler.scan;
    if (handler.locator) this.locatorHandler = handler.locator;
  }
}

@Global()
@Module({
  providers: [CustodyPortRegistry],
  exports: [CustodyPortRegistry],
})
export class CustodyPortsModule {}
