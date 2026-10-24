import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Discipline } from '../../core/discipline/discipline.decorator';
import { Roles } from '../../common/decorators/auth.decorators';
import { currentActor } from '../../common/utils/actor';
import { MicrobiologyService } from './microbiology.service';

@ApiTags('Microbiology')
@ApiBearerAuth()
@Discipline('MICROBIOLOGY')
@Controller('micro')
export class MicrobiologyController {
  constructor(private readonly micro: MicrobiologyService) {}

  @Get('organisms')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  organisms() {
    return this.micro.organisms();
  }

  @Post('organisms')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  createOrganism(@Body() body: unknown) {
    return this.micro.createOrganism(body, currentActor());
  }

  @Get('antibiotics')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  antibiotics() {
    return this.micro.antibiotics();
  }

  @Post('antibiotics')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  createAntibiotic(@Body() body: unknown) {
    return this.micro.createAntibiotic(body, currentActor());
  }

  @Get('breakpoints')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  breakpoints(@Query('organism') organism?: string, @Query('antibiotic') antibiotic?: string) {
    return this.micro.breakpoints(organism, antibiotic);
  }

  @Post('breakpoints')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  createBreakpoint(@Body() body: unknown) {
    return this.micro.createBreakpoint(body, currentActor());
  }

  @Get('cultures')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  cultures(@Query('status') status?: string) {
    return this.micro.cultures(status);
  }

  @Post('cultures')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST')
  createCulture(@Body() body: unknown) {
    return this.micro.createCulture(body, currentActor());
  }

  @Get('cultures/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  culture(@Param('id') id: string) {
    return this.micro.culture(id);
  }

  @Patch('cultures/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  updateCulture(@Param('id') id: string, @Body() body: unknown) {
    return this.micro.updateCulture(id, body, currentActor());
  }

  @Post('cultures/:id/isolates')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST')
  addIsolate(@Param('id') id: string, @Body() body: unknown) {
    return this.micro.addIsolate(id, body, currentActor());
  }

  @Post('cultures/:id/ast')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST')
  ast(@Param('id') id: string, @Body() body: unknown) {
    return this.micro.susceptibility(id, body, currentActor());
  }

  @Get('antibiogram')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  antibiogram(@Query('from') from?: string, @Query('to') to?: string) {
    return this.micro.antibiogram(from, to);
  }

  @Get('whonet')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST')
  async whonet(
    @Res({ passthrough: true }) response: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.micro.whonet(from, to);
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="whonet-export.csv"',
    });
    return csv;
  }
}
