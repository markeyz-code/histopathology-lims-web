import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { TestRequestsModule } from '../test-requests/test-requests.module';
import { TestRequestModelName, TestRequestSchema } from '../test-requests/test-request.schema';
import { UserModelName, UserSchema } from '../users/user.schema';
import { QualityController } from './quality.controller';
import { QualityService } from './quality.service';
import {
  CapaActionModelName,
  CapaActionSchema,
  EquipmentModelName,
  EquipmentSchema,
  NonConformanceModelName,
  NonConformanceSchema,
  SendOutModelName,
  SendOutSchema,
  TemperatureLogModelName,
  TemperatureLogSchema,
} from './quality.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EquipmentModelName, schema: EquipmentSchema },
      { name: TemperatureLogModelName, schema: TemperatureLogSchema },
      { name: NonConformanceModelName, schema: NonConformanceSchema },
      { name: CapaActionModelName, schema: CapaActionSchema },
      { name: SendOutModelName, schema: SendOutSchema },
      { name: TestRequestModelName, schema: TestRequestSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: UserModelName, schema: UserSchema },
    ]),
    TestRequestsModule,
    AuditModule,
  ],
  controllers: [QualityController],
  providers: [QualityService],
  exports: [QualityService],
})
export class QualityModule {}
