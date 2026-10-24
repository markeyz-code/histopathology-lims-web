import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { InstrumentsService } from './instruments.service';

@ApiTags('Instrument connector')
@ApiBearerAuth()
@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  @Post('messages')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST')
  ingest(@Body() body: { protocol: 'ASTM' | 'HL7'; message: string }) {
    return this.instruments.ingest(body.protocol, body.message);
  }

  @Get('messages')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST', 'PATHOLOGIST')
  list() {
    return this.instruments.list();
  }
}
