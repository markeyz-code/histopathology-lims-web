import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { currentActor } from '../../common/utils/actor';
import { QcService } from './qc.service';

@ApiTags('Quality control')
@ApiBearerAuth()
@Controller('qc')
export class QcController {
  constructor(private readonly qc: QcService) {}

  @Get('materials')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  materials(@Query('discipline') discipline?: string) {
    return this.qc.listMaterials(discipline as never);
  }

  @Post('materials')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST')
  createMaterial(@Body() body: unknown) {
    return this.qc.createMaterial(body, currentActor());
  }

  @Get('runs')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  runs(
    @Query('discipline') discipline?: string,
    @Query('materialId') materialId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.qc.listRuns({
      discipline: discipline as never,
      materialId,
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 50)),
    });
  }

  @Post('runs')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST')
  run(@Body() body: unknown) {
    return this.qc.run(body, currentActor());
  }
}
