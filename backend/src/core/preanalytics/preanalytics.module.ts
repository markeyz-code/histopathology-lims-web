import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { TestRequestModelName, TestRequestSchema } from '../test-requests/test-request.schema';
import { PreanalyticsController } from './preanalytics.controller';
import { PreanalyticsService } from './preanalytics.service';
import {
  CollectionCentreModelName,
  CollectionCentreSchema,
  ConsignmentModelName,
  ConsignmentSchema,
} from './preanalytics.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CollectionCentreModelName, schema: CollectionCentreSchema },
      { name: ConsignmentModelName, schema: ConsignmentSchema },
      { name: TestRequestModelName, schema: TestRequestSchema },
    ]),
    AuditModule,
  ],
  controllers: [PreanalyticsController],
  providers: [PreanalyticsService],
  exports: [PreanalyticsService],
})
export class PreanalyticsModule {}
