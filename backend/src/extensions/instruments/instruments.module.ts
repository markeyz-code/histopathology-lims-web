import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LabModelName, LabSchema } from '../../core/labs/lab.schema';
import {
  TestRequestModelName,
  TestRequestSchema,
} from '../../core/test-requests/test-request.schema';
import { InstrumentsController } from './instruments.controller';
import { InstrumentsService } from './instruments.service';
import { InstrumentMessageModelName, InstrumentMessageSchema } from './instrument.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InstrumentMessageModelName, schema: InstrumentMessageSchema },
      { name: TestRequestModelName, schema: TestRequestSchema },
      { name: LabModelName, schema: LabSchema },
    ]),
  ],
  controllers: [InstrumentsController],
  providers: [InstrumentsService],
  exports: [InstrumentsService],
})
export class InstrumentsModule {}
