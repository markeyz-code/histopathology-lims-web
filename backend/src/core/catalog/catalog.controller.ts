import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { currentActor } from '../../common/utils/actor';
import { Roles } from '../../common/decorators/auth.decorators';
import { CatalogService } from './catalog.service';

@ApiTags('Test catalogue')
@ApiBearerAuth()
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('tests')
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
  listTests(
    @Query('discipline') discipline?: string,
    @Query('q') q?: string,
    @Query('active') active?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.catalog.listTests({
      discipline: discipline as never,
      q,
      active: active === undefined ? undefined : active === 'true',
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 50)),
    });
  }

  @Get('panels')
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
  listPanels(
    @Query('discipline') discipline?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.catalog.listPanels({
      discipline: discipline as never,
      page: Math.max(1, Number(page) || 1),
      limit: Math.min(100, Math.max(1, Number(limit) || 50)),
    });
  }

  @Post('tests')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  createTest(@Body() body: unknown) {
    return this.catalog.createTest(body, currentActor());
  }

  @Patch('tests/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  updateTest(@Param('id') id: string, @Body() body: unknown) {
    return this.catalog.updateTest(id, body, currentActor());
  }

  @Post('panels')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  createPanel(@Body() body: unknown) {
    return this.catalog.createPanel(body, currentActor());
  }
}
