import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import type { PortalCaseDetail, PortalCaseSummary, PortalRequestResult } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public, Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { PortalRequestDto, PortalVerifyDto } from './dto/portal.dto';
import { PortalService } from './portal.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('Referrer portal')
@Controller('portal')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Public()
  @Post('auth/request')
  @HttpCode(202)
  @ApiOperation({ summary: 'Request a referral portal magic link and one-time code' })
  request(@Body() dto: PortalRequestDto): Promise<PortalRequestResult> {
    return this.portal.request(dto);
  }

  @Public()
  @Post('auth/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange a magic link or one-time code for a referral session' })
  verify(@Body() dto: PortalVerifyDto) {
    return this.portal.verify(dto);
  }

  @Get('cases')
  @Roles('REFERRER', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cases belonging to the signed-in referring clinician' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ): Promise<{
    items: PortalCaseSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  }> {
    return this.portal.listCases(user.id, user.email, query.page, query.limit);
  }

  @Get('cases/:id')
  @Roles('REFERRER', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Referrer-safe case detail and released report' })
  detail(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PortalCaseDetail> {
    return this.portal.getCase(id, user.id, user.email);
  }

  @Get('cases/:id/report.pdf')
  @Roles('REFERRER', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download the released report PDF' })
  async pdf(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const generated = await this.portal.getReportPdf(id, user.id, user.email);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${generated.filename}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(createReadStream(generated.path));
  }
}
