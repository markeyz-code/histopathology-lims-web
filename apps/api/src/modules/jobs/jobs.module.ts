import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { NotificationModelName, NotificationSchema } from '../notifications/notification.schema';
import { PdfModule } from '../pdf/pdf.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { TatCheckService } from './tat-check.service';

@Module({
  imports: [
    PdfModule,
    MongooseModule.forFeature([
      { name: LabModelName, schema: LabSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: NotificationModelName, schema: NotificationSchema },
    ]),
  ],
  controllers: [JobsController],
  providers: [JobsService, TatCheckService],
  exports: [JobsService, TatCheckService],
})
export class JobsModule {}
