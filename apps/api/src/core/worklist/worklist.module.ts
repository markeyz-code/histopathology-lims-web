import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CasesModule } from '../cases/cases.module';
import { TestRequestsModule } from '../test-requests/test-requests.module';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { LabsModule } from '../labs/labs.module';
import { WorklistController } from './worklist.controller';
import { WorklistService } from './worklist.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CaseModelName, schema: CaseSchema }]),
    CasesModule,
    TestRequestsModule,
    LabsModule,
  ],
  controllers: [WorklistController],
  providers: [WorklistService],
})
export class WorklistModule {}
