import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated, Slide } from '@lims/shared';
import { Roles } from '../../common/decorators/auth.decorators';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { CutSlidesDto, RecutRequestDto, SlideListQueryDto, StainRequestDto } from './dto/slide.dto';
import { SlidesService } from './slides.service';

@ApiTags('Slides')
@ApiBearerAuth()
@Controller('slides')
export class SlidesController {
  constructor(private readonly slidesService: SlidesService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'List slides, optionally by case or block' })
  list(@Query() query: SlideListQueryDto): Promise<Paginated<Slide>> {
    return this.slidesService.list(query);
  }

  @Post('cut')
  @Roles('TECHNOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Record slide cutting and create uniquely labelled slides' })
  cut(@Body() dto: CutSlidesDto): Promise<Slide[]> {
    return this.slidesService.cut(dto);
  }

  @Post('request')
  @Roles('PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Request a special stain or immunohistochemistry slide' })
  requestStain(@Body() dto: StainRequestDto): Promise<Slide> {
    return this.slidesService.requestStain(dto);
  }

  @Post(':id/recut')
  @Roles('PATHOLOGIST', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Request a recut of a reviewed slide' })
  recut(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: RecutRequestDto): Promise<Slide> {
    return this.slidesService.requestRecut(id, dto);
  }
}
