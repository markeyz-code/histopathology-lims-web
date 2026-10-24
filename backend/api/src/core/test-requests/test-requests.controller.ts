import { Controller, Get, Param, Query, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { isClinicalRole, type Discipline } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { TestRequestQueryDto } from './dto/test-request.dto';
import { TestRequestsService } from './test-requests.service';

@ApiTags('Test requests')
@ApiBearerAuth()
@Controller('test-requests')
export class TestRequestsController {
  constructor(private readonly testRequests: TestRequestsService) {}

  @Get()
  @Roles(
    'SUPER_ADMIN',
    'LAB_ADMIN',
    'RECEPTIONIST',
    'PHLEBOTOMIST',
    'GROSSER',
    'TECHNOLOGIST',
    'SCIENTIST',
    'PATHOLOGIST',
  )
  @ApiOperation({ summary: 'List test requests across the case accession' })
  list(@Query() query: TestRequestQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const allowed = this.allowed(user);
    if (query.discipline && !allowed.includes(query.discipline)) {
      throw new ForbiddenException('You are not assigned to this discipline.');
    }
    return this.testRequests.list(query, allowed);
  }

  @Get('case/:caseId')
  @Roles(
    'SUPER_ADMIN',
    'LAB_ADMIN',
    'RECEPTIONIST',
    'PHLEBOTOMIST',
    'GROSSER',
    'TECHNOLOGIST',
    'SCIENTIST',
    'PATHOLOGIST',
  )
  @ApiOperation({ summary: 'Test requests belonging to a case' })
  forCase(
    @Param('caseId', ParseObjectIdPipe) caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.testRequests.forCase(caseId, this.allowed(user));
  }

  private allowed(user: AuthenticatedUser): Discipline[] {
    if (!isClinicalRole(user.role)) return user.labEnabledDisciplines;
    return user.disciplines.length > 0 ? user.disciplines : ['HISTOPATHOLOGY'];
  }
}
