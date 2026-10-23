import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { BlockModelName, BlockSchema } from '../blocks/block.schema';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { CustodyModule } from '../custody/custody.module';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlideModelName, SlideSchema } from '../slides/slide.schema';
import { UserModelName, UserSchema } from '../users/user.schema';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ReagentLotModelName, ReagentLotSchema } from './reagent-lot.schema';
import { StainRunModelName, StainRunSchema } from './stain-run.schema';

@Module({
  imports: [
    AuditModule,
    CustodyModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: ReagentLotModelName, schema: ReagentLotSchema },
      { name: StainRunModelName, schema: StainRunSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: BlockModelName, schema: BlockSchema },
      { name: SlideModelName, schema: SlideSchema },
      { name: UserModelName, schema: UserSchema },
      { name: LabModelName, schema: LabSchema },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
