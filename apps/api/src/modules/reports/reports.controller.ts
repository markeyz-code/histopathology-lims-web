import { Body, Controller, Get, Param, Patch, Post, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import type { PdfJobResult, ReportDetail, VerifyReportResult } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/auth.decorators';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import {
  AmendReportDto,
  CreateReportDto,
  ReleaseReportDto,
  UpdateReportDto,
} from './dto/report.dto';
import { ReportsService } from './reports.service';

const REPORT_READ_ROLES = [
  'SUPER_ADMIN',
  'LAB_ADMIN',
  'RECEPTIONIST',
  'GROSSER',
  'TECHNOLOGIST',
  'PATHOLOGIST',
] as const;

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('case/:caseId')
  @Roles(...REPORT_READ_ROLES)
  @ApiOperation({ summary: 'Get the report for a case, including immutable versions' })
  getByCase(@Param('caseId', ParseObjectIdPipe) caseId: string): Promise<ReportDetail | null> {
    return this.reportsService.getByCase(caseId);
  }

  @Public()
  @Get('verify/:code')
  @ApiOperation({ summary: 'Public verification of a signed report by QR code' })
  verify(@Param('code') code: string): Promise<VerifyReportResult> {
    return this.reportsService.verify(code);
  }

  @Post('case/:caseId')
  @Roles('PATHOLOGIST', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Start a draft synoptic report from a protocol' })
  create(
    @Param('caseId', ParseObjectIdPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
  ): Promise<ReportDetail> {
    return this.reportsService.createDraft(caseId, dto, user);
  }

  @Patch(':id')
  @Roles('PATHOLOGIST', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Save structured report data while in draft (draft-only)' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateReportDto,
  ): Promise<ReportDetail> {
    return this.reportsService.updateDraft(id, dto, user);
  }

  @Post(':id/sign-out')
  @Roles('PATHOLOGIST', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Validate required fields, sign out and lock the report',
    description:
      'Sign-out writes an immutable version, marks reviewed slides and blocks REPORTED and advances the case.',
  })
  signOut(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportDetail> {
    return this.reportsService.signOut(id, user);
  }

  @Post(':id/amend')
  @Roles('PATHOLOGIST', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Amend a signed report with a reason and a new immutable version' })
  amend(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AmendReportDto,
  ): Promise<ReportDetail> {
    return this.reportsService.amend(id, dto, user);
  }

  @Post(':id/release')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Release a signed report to the referrer portal' })
  release(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReleaseReportDto,
  ): Promise<ReportDetail> {
    return this.reportsService.release(id, dto, user);
  }

  @Post(':id/pdf')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Queue server-side PDF generation with BullMQ' })
  enqueuePdf(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PdfJobResult> {
    return this.reportsService.enqueuePdf(id, user);
  }

  @Get(':id/pdf')
  @Roles(...REPORT_READ_ROLES)
  @ApiProduces('application/pdf')
  @ApiOperation({ summary: 'Download the server-rendered report PDF (inline preview supported)' })
  async pdf(
    @Param('id', ParseObjectIdPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const generated = await this.reportsService.getPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${generated.filename}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(createReadStream(generated.path));
  }

  @Get(':id')
  @Roles(...REPORT_READ_ROLES)
  @ApiOperation({ summary: 'Get a report by id' })
  get(@Param('id', ParseObjectIdPipe) id: string): Promise<ReportDetail> {
    return this.reportsService.getById(id);
  }
}
