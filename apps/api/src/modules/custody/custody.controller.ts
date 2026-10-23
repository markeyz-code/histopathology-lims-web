import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CustodyEvent, LocatorResult, ScanResponse } from '@lims/shared';
import { Roles } from '../../common/decorators/auth.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { ScanDto } from './dto/scan.dto';
import { LocatorService } from './locator.service';
import { ScanService } from './scan.service';

@ApiTags('Custody')
@ApiBearerAuth()
@Controller('custody')
export class CustodyController {
  constructor(
    private readonly scanService: ScanService,
    private readonly locatorService: LocatorService,
  ) {}

  @Post('scan')
  @UseGuards(RolesGuard)
  @Roles('GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Scan a barcode at a station and advance its state machine',
    description:
      'The station determines the event. Invalid transitions return 409 with the allowed next states.',
  })
  scan(@Body() dto: ScanDto): Promise<ScanResponse> {
    return this.scanService.scan(dto);
  }

  @Get('locator/:barcode')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Locate a specimen, block or slide and return its custody timeline' })
  locate(@Param('barcode') barcode: string): Promise<LocatorResult> {
    return this.locatorService.locate(barcode);
  }

  @Get('case/:caseId/timeline')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Full case custody timeline' })
  caseTimeline(@Param('caseId', ParseObjectIdPipe) caseId: string): Promise<CustodyEvent[]> {
    return this.locatorService.caseTimeline(caseId);
  }

  @Get('entity/:entityType/:entityId/timeline')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Custody timeline for one specimen, block or slide' })
  entityTimeline(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseObjectIdPipe) entityId: string,
  ): Promise<CustodyEvent[]> {
    return this.locatorService.entityTimeline(entityType, entityId);
  }
}
