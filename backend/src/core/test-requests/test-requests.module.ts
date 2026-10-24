import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { TestRequestsController } from './test-requests.controller';
import { TestRequestModelName, TestRequestSchema } from './test-request.schema';
import { TestRequestsService } from './test-requests.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestRequestModelName, schema: TestRequestSchema },
      { name: CaseModelName, schema: CaseSchema },
    ]),
  ],
  controllers: [TestRequestsController],
  providers: [TestRequestsService],
  exports: [TestRequestsService],
})
export class TestRequestsModule {}
