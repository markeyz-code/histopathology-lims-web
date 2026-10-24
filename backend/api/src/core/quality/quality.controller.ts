import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { currentActor } from '../../common/utils/actor';
import { QualityService } from './quality.service';

@ApiTags('Quality management')
@ApiBearerAuth()
@Controller('quality')
export class QualityController {
  constructor(private readonly quality: QualityService) {}

  @Get('equipment')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  equipment() {
    return this.quality.equipment();
  }

  @Post('equipment')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  createEquipment(@Body() body: unknown) {
    return this.quality.createEquipment(body, currentActor());
  }

  @Get('equipment/:id/temperature')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  temperatures(@Param('id') id: string) {
    return this.quality.temperatureLogs(id);
  }

  @Post('equipment/:id/temperature')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST')
  recordTemperature(@Param('id') id: string, @Body() body: unknown) {
    return this.quality.recordTemperature(id, body, currentActor());
  }

  @Get('nonconformances')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  nonconformances() {
    return this.quality.nonConformances();
  }

  @Post('nonconformances')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  createNc(@Body() body: unknown) {
    return this.quality.createNonConformance(body, currentActor());
  }

  @Patch('nonconformances/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST')
  updateNc(@Param('id') id: string, @Body() body: unknown) {
    return this.quality.updateNonConformance(id, body, currentActor());
  }

  @Post('nonconformances/:id/capa')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST')
  addCapa(@Param('id') id: string, @Body() body: unknown) {
    return this.quality.addCapa(id, body, currentActor());
  }

  @Get('send-outs')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST', 'SCIENTIST', 'TECHNOLOGIST')
  sendOuts() {
    return this.quality.sendOuts();
  }

  @Post('send-outs')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST')
  createSendOut(@Body() body: unknown) {
    return this.quality.createSendOut(body, currentActor());
  }

  @Patch('send-outs/:id')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  updateSendOut(@Param('id') id: string, @Body() body: unknown) {
    return this.quality.updateSendOut(id, body, currentActor());
  }
}
