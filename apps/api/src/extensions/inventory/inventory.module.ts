import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../../core/audit/audit.module';
import { BlockModelName, BlockSchema } from '../../disciplines/histopathology/blocks/block.schema';
import { CaseModelName, CaseSchema } from '../../core/cases/case.schema';
import { CustodyModule } from '../../core/custody/custody.module';
import { LabModelName, LabSchema } from '../../core/labs/lab.schema';
import { NotificationsModule } from '../../core/notifications/notifications.module';
import { SlideModelName, SlideSchema } from '../../disciplines/histopathology/slides/slide.schema';
import { UserModelName, UserSchema } from '../../core/users/user.schema';
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
