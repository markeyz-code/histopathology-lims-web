import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { Roles } from '../../common/decorators/auth.decorators';
import { Hl7MessageDto } from './dto/hl7.dto';
import { Hl7Service } from './hl7.service';

@ApiTags('HL7 v2')
@ApiBearerAuth()
@Controller('interop/hl7')
export class Hl7Controller {
  constructor(private readonly hl7: Hl7Service) {}

  @Post('messages')
  @Roles('LAB_ADMIN', 'SUPER_ADMIN', 'TECHNOLOGIST')
  @ApiOperation({ summary: 'Ingest an HL7 v2 ORM/OML order and return an ACK' })
  ingest(@Body() dto: Hl7MessageDto) {
    return this.hl7.ingest(dto.message);
  }

  @Get('oru/:caseId')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Render a signed report as an HL7 v2 ORU^R01 message' })
  oru(@Param('caseId', ParseObjectIdPipe) caseId: string) {
    return this.hl7.buildOru(caseId);
  }
}
