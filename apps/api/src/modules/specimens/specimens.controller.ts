import { Body, Controller, Param, Post, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated, Specimen } from '@lims/shared';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { RejectSpecimenDto, SpecimenListQueryDto } from './dto/specimen.dto';
import { SpecimensService } from './specimens.service';

@ApiTags('Specimens')
@ApiBearerAuth()
@Controller('specimens')
export class SpecimensController {
  constructor(private readonly specimensService: SpecimensService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'List specimens, optionally by case' })
  list(@Query() query: SpecimenListQueryDto): Promise<Paginated<Specimen>> {
    return this.specimensService.list(query);
  }

  @Post(':id/reject')
  @Roles('RECEPTIONIST', 'GROSSER', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Reject a specimen with a reason' })
  reject(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RejectSpecimenDto,
  ): Promise<Specimen> {
    return this.specimensService.reject(id, dto.reason);
  }
}
