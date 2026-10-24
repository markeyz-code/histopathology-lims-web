import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { RulesModule } from '../rules/rules.module';
import { TestRequestsModule } from '../test-requests/test-requests.module';
import { TestRequestModelName, TestRequestSchema } from '../test-requests/test-request.schema';
import { UserModelName, UserSchema } from '../users/user.schema';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';
import { ResultPdfService } from './result-pdf.service';
import {
  ResultSetModelName,
  ResultSetSchema,
  ResultVersionModelName,
  ResultVersionSchema,
} from './result.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ResultSetModelName, schema: ResultSetSchema },
      { name: ResultVersionModelName, schema: ResultVersionSchema },
      { name: TestRequestModelName, schema: TestRequestSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: LabModelName, schema: LabSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: UserModelName, schema: UserSchema },
    ]),
    CatalogModule,
    RulesModule,
    TestRequestsModule,
    AuditModule,
    NotificationsModule,
  ],
  controllers: [ResultsController],
  providers: [ResultsService, ResultPdfService],
  exports: [ResultsService, ResultPdfService],
})
export class ResultsModule {}
