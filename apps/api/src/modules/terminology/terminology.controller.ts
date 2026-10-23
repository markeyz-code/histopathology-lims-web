import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { ImportTerminologyDto, TerminologyQueryDto } from './dto/terminology.dto';
import { TerminologyService } from './terminology.service';

@ApiTags('Terminology')
@ApiBearerAuth()
@Controller('terminology')
export class TerminologyController {
  constructor(private readonly terminology: TerminologyService) {}

  @Get('search')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'Search SNOMED CT and ICD-O-3 codes configured for this laboratory' })
  search(@Query() query: TerminologyQueryDto) {
    return this.terminology.search(query);
  }

  @Post('import')
  @Roles('SUPER_ADMIN', 'LAB_ADMIN')
  @ApiOperation({ summary: 'Import a licensed SNOMED/ICD-O-3 subset supplied by the laboratory' })
  import(@Body() dto: ImportTerminologyDto) {
    return this.terminology.import(dto);
  }
}
