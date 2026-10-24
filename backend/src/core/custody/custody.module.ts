import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { SpecimenModelName, SpecimenSchema } from '../specimens/specimen.schema';
import { CaseWorkflowService } from './case-workflow.service';
import { CustodyController } from './custody.controller';
import { CustodyEventModelName, CustodyEventSchema } from './custody-event.schema';
import { CustodyService } from './custody.service';
import { CustodyPortsModule } from './custody-ports';
import { TestRequestsModule } from '../test-requests/test-requests.module';

@Module({
  imports: [
    CustodyPortsModule,
    TestRequestsModule,
    MongooseModule.forFeature([
      { name: CustodyEventModelName, schema: CustodyEventSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
    ]),
  ],
  controllers: [CustodyController],
  providers: [CustodyService, CaseWorkflowService],
  exports: [CustodyService, CaseWorkflowService],
})
export class CustodyModule {}
