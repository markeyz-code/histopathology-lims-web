import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CaseLabelQueryDto, LabelQueryDto } from './dto/label.dto';
import { LabelsService } from './labels.service';

@ApiTags('Labels')
@ApiBearerAuth()
@Controller('labels')
export class LabelsController {
  constructor(private readonly labelsService: LabelsService) {}

  @Get('case/:caseId')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiProduces('application/pdf', 'text/plain', 'image/svg+xml')
  @ApiOperation({ summary: 'Print-ready label sheet for a case (PDF, ZPL or SVG preview)' })
  async caseLabels(
    @Param('caseId', ParseObjectIdPipe) caseId: string,
    @Query() query: CaseLabelQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | string> {
    const result = await this.labelsService.caseLabels(
      caseId,
      query.format ?? 'pdf',
      query.symbology ?? 'datamatrix',
      query.include ?? 'all',
    );
    return this.respond(res, result);
  }

  @Get(':entityType/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiProduces('application/pdf', 'text/plain', 'image/svg+xml')
  @ApiOperation({ summary: 'Print-ready label for one specimen, block or slide' })
  async entityLabel(
    @Param('entityType') entityType: string,
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: LabelQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | string> {
    const result = await this.labelsService.entityLabel(
      entityType,
      id,
      query.format ?? 'pdf',
      query.symbology ?? 'datamatrix',
    );
    return this.respond(res, result);
  }

  private respond(
    res: Response,
    result: { body: Buffer | string; contentType: string; filename: string },
  ): StreamableFile | string {
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `inline; filename="${result.filename}"`,
      'Cache-Control': 'private, no-store',
    });
    return typeof result.body === 'string' ? result.body : new StreamableFile(result.body);
  }
}
