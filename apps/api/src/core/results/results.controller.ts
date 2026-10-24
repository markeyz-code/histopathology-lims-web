import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Discipline } from '@lims/shared';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { ResultsService } from './results.service';

@ApiTags('Results')
@ApiBearerAuth()
@Controller('results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get('worklist')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  worklist(@Query('discipline') discipline: Discipline, @CurrentUser() user: AuthenticatedUser) {
    return this.results.worklist(discipline, user);
  }

  @Get('cumulative/:patientId')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  cumulative(
    @Param('patientId') patientId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('disciplines') disciplines?: string,
  ) {
    return this.results.cumulative(
      patientId,
      from,
      to,
      disciplines?.split(',').filter(Boolean) as Discipline[] | undefined,
    );
  }

  @Post()
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST')
  create(@Body() body: { testRequestId: string }, @CurrentUser() user: AuthenticatedUser) {
    return this.results.create(body.testRequestId, user);
  }

  @Get(':id/versions')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  versions(@Param('id') id: string) {
    return this.results.versions(id);
  }

  @Get(':id/executions')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  executions(@Param('id') id: string) {
    return this.results.executions(id);
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  get(@Param('id') id: string) {
    return this.results.getById(id);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      values: Array<{ analyteKey: string; value: number | string | null }>;
      comment?: string | null;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.results.update(id, body, user);
  }

  @Post(':id/verify')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'PATHOLOGIST')
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.results.verify(id, user);
  }

  @Post(':id/release')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST')
  release(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.results.release(id, user);
  }

  @Post(':id/acknowledge-critical')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'PATHOLOGIST')
  acknowledge(
    @Param('id') id: string,
    @Body() body: { note: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.results.acknowledgeCritical(id, body.note, user);
  }
}
