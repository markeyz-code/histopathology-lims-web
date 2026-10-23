import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/auth.decorators';
import { SyncBatchDto } from './dto/sync.dto';
import { SyncService } from './sync.service';

@ApiTags('Offline sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('batch')
  @Roles('GROSSER', 'TECHNOLOGIST', 'PATHOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Replay an idempotent offline scan queue' })
  batch(@Body() dto: SyncBatchDto) {
    return this.sync.batch(dto);
  }
}
