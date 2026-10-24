import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { currentActor } from '../../common/utils/actor';
import { RulesService } from './rules.service';

@ApiTags('Rules')
@ApiBearerAuth()
@Controller('rules')
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  list(@Query('discipline') discipline?: string, @Query('active') active?: string) {
    return this.rules.list(
      discipline as never,
      active === undefined ? undefined : active === 'true',
    );
  }

  @Post()
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  create(@Body() body: unknown) {
    return this.rules.create(body, currentActor());
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.rules.update(id, body, currentActor());
  }

  @Get('executions')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST')
  executions(@Query('resultSetId') resultSetId?: string) {
    return this.rules.executions(resultSetId);
  }
}
