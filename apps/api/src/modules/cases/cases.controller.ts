import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CaseDetail, CaseListItem, Paginated } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CasesService } from './cases.service';
import { AccessionDto, AssignCaseDto, CaseListQueryDto, UpdateCaseDto } from './dto/case.dto';

const CLINICAL_ROLES = [
  'SUPER_ADMIN',
  'LAB_ADMIN',
  'RECEPTIONIST',
  'GROSSER',
  'TECHNOLOGIST',
  'PATHOLOGIST',
] as const;

@ApiTags('Cases')
@ApiBearerAuth()
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

  @Post('accession')
  @Roles('RECEPTIONIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Accession a patient, specimens and clinical history',
    description:
      'Creates the case, patient (or reuses an MRN), specimens and initial custody events in one transaction.',
  })
  accession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AccessionDto,
  ): Promise<CaseDetail> {
    return this.casesService.accession(dto, user);
  }

  @Get()
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Paginated, filterable case register' })
  list(@Query() query: CaseListQueryDto): Promise<Paginated<CaseListItem>> {
    return this.casesService.list(query);
  }

  @Get(':id')
  @Roles(...CLINICAL_ROLES)
  @ApiOperation({ summary: 'Case detail with specimens, blocks, slides, report and timeline' })
  get(@Param('id', ParseObjectIdPipe) id: string): Promise<CaseDetail> {
    return this.casesService.getDetail(id);
  }

  @Patch(':id/assign')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Assign or unassign a pathologist' })
  assign(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignCaseDto,
  ): Promise<CaseDetail> {
    return this.casesService.assign(id, dto, user);
  }

  @Patch(':id')
  @Roles('RECEPTIONIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Correct clinical history, diagnosis, priority or subspecialty' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCaseDto,
  ): Promise<CaseDetail> {
    return this.casesService.update(id, dto, user);
  }
}
