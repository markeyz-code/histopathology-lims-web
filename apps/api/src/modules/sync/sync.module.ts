import { Module } from '@nestjs/common';
import { CustodyModule } from '../custody/custody.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [CustodyModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
