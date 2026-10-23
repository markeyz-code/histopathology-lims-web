import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Block, Paginated } from '@lims/shared';
import { Roles } from '../../common/decorators/auth.decorators';
import { BlockListQueryDto, GrossBlockDto } from './dto/block.dto';
import { BlocksService } from './blocks.service';

@ApiTags('Blocks')
@ApiBearerAuth()
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Get()
  @Roles('SUPER_ADMIN', 'LAB_ADMIN', 'RECEPTIONIST', 'GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST')
  @ApiOperation({ summary: 'List blocks, optionally filtered by case or specimen' })
  list(@Query() query: BlockListQueryDto): Promise<Paginated<Block>> {
    return this.blocksService.list(query);
  }

  @Post('gross')
  @Roles('GROSSER', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Record gross examination and create cassettes with unique labels',
    description:
      'Created blocks start ACCESSIONED and must be scanned at grossing before processing.',
  })
  gross(@Body() dto: GrossBlockDto): Promise<Block[]> {
    return this.blocksService.gross(dto);
  }
}
