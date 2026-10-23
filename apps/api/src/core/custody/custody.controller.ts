import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CustodyEvent, LocatorResult, ScanResponse } from '@lims/shared';
import { Roles } from '../../common/decorators/auth.decorators';
import { Discipline } from '../discipline/discipline.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ScanDto } from './dto/scan.dto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { CustodyPortRegistry } from './custody-ports';

@ApiTags('Custody')
@ApiBearerAuth()
@Controller('custody')
export class CustodyController {
  constructor(
    private readonly ports: CustodyPortRegistry,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post('scan')
  @Discipline('HISTOPATHOLOGY')
  @UseGuards(RolesGuard)
  @Roles('GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Scan a barcode at a station and advance its state machine',
    description:
      'The station determines the event. Invalid transitions return 409 with the allowed next states.',
  })
  async scan(
    @Body() dto: ScanDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<ScanResponse> {
    const handler = this.ports.scanHandler;
    if (!handler)
      throw new ServiceUnavailableException('No scan handler is registered for this laboratory.');
    if (!idempotencyKey) return handler.scan(dto);
    const result = await this.idempotency.run(
      idempotencyKey,
      this.idempotency.hash(dto),
      'custody-scan',
      () => handler.scan(dto),
    );
    return result.value;
  }

  @Get('locator/:barcode')
  @Discipline('HISTOPATHOLOGY')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Locate a specimen, block or slide and return its custody timeline' })
  locate(@Param('barcode') barcode: string): Promise<LocatorResult> {
    return this.locator().locate(barcode);
  }

  @Get('case/:caseId/timeline')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Full case custody timeline' })
  caseTimeline(@Param('caseId', ParseObjectIdPipe) caseId: string): Promise<CustodyEvent[]> {
    return this.locator().caseTimeline(caseId);
  }

  @Get('entity/:entityType/:entityId/timeline')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Custody timeline for one specimen, block or slide' })
  entityTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseObjectIdPipe) entityId: string,
  ): Promise<CustodyEvent[]> {
    return this.locator().entityTimeline(entityType, entityId);
  }

  private locator() {
    const handler = this.ports.locatorHandler;
    if (!handler)
      throw new ServiceUnavailableException(
        'No locator handler is registered for this laboratory.',
      );
    return handler;
  }
}
