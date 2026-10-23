import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { SlideModelName, SlideSchema } from '../slides/slide.schema';
import { WsiController } from './wsi.controller';
import { WsiService } from './wsi.service';

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: SlideModelName, schema: SlideSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: LabModelName, schema: LabSchema },
    ]),
  ],
  controllers: [WsiController],
  providers: [WsiService],
  exports: [WsiService],
})
export class WsiModule {}
