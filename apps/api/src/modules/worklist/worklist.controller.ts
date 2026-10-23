import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CaseDetail, WorklistResult } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CasesService } from '../cases/cases.service';
import { WorklistQueryDto } from './dto/worklist-query.dto';
import { WorklistService } from './worklist.service';

@ApiTags('Worklist')
@ApiBearerAuth()
@Controller('worklist')
export class WorklistController {
  constructor(
    private readonly worklistService: WorklistService,
    private readonly casesService: CasesService,
  ) {}

  @Get()
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Pathologist worklist ordered frozen → urgent → routine, then TAT deadline',
  })
  get(
    @Query() query: WorklistQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorklistResult> {
    return this.worklistService.getWorklist(query, user);
  }

  @Post(':caseId/claim')
  @Roles('PATHOLOGIST', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Assign a case to the signed-in pathologist' })
  claim(
    @Param('caseId', ParseObjectIdPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CaseDetail> {
    return this.casesService.assign(caseId, { pathologistId: user.id }, user);
  }
}
