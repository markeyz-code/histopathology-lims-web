import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { currentActor } from '../../common/utils/actor';
import { PreanalyticsService } from './preanalytics.service';

@ApiTags('Pre-analytics')
@ApiBearerAuth()
@Controller('preanalytics')
export class PreanalyticsController {
  constructor(private readonly preanalytics: PreanalyticsService) {}

  @Get('centres')
  @Roles(
    'SUPER_ADMIN',
    'LAB_ADMIN',
    'RECEPTIONIST',
    'PHLEBOTOMIST',
    'SCIENTIST',
    'TECHNOLOGIST',
    'PATHOLOGIST',
  )
  centres() {
    return this.preanalytics.centres();
  }

  @Post('centres')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST')
  createCentre(@Body() body: unknown) {
    return this.preanalytics.createCentre(body, currentActor());
  }

  @Get('consignments')
  @Roles(
    'SUPER_ADMIN',
    'LAB_ADMIN',
    'RECEPTIONIST',
    'PHLEBOTOMIST',
    'SCIENTIST',
    'TECHNOLOGIST',
    'PATHOLOGIST',
  )
  consignments() {
    return this.preanalytics.consignments();
  }

  @Post('consignments')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'PHLEBOTOMIST')
  createConsignment(@Body() body: unknown) {
    return this.preanalytics.createConsignment(body, currentActor());
  }

  @Post('consignments/:id/dispatch')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'PHLEBOTOMIST')
  dispatch(@Param('id') id: string) {
    return this.preanalytics.dispatch(id, currentActor());
  }

  @Post('consignments/:id/receive')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'PHLEBOTOMIST', 'SCIENTIST', 'TECHNOLOGIST')
  receive(@Param('id') id: string, @Body() body: unknown) {
    return this.preanalytics.receive(id, body, currentActor());
  }
}
