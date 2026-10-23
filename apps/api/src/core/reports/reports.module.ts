import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { CustodyModule } from '../custody/custody.module';
import { JobsModule } from '../jobs/jobs.module';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { QaModule } from '../../extensions/qa/qa.module';
import { TerminologyModule } from '../../extensions/terminology/terminology.module';
import { UserModelName, UserSchema } from '../users/user.schema';
import { ReportAssemblerService } from './report-assembler.service';
import { ReportVersionModelName, ReportVersionSchema } from './report-version.schema';
import { ReportModelName, ReportSchema } from './report.schema';
import { ReportsController } from './reports.controller';
import { ReportPortsModule } from './report-ports';
import { TestRequestsModule } from '../test-requests/test-requests.module';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportModelName, schema: ReportSchema },
      { name: ReportVersionModelName, schema: ReportVersionSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: UserModelName, schema: UserSchema },
      { name: LabModelName, schema: LabSchema },
    ]),
    CustodyModule,
    JobsModule,
    QaModule,
    TerminologyModule,
    ReportPortsModule,
    TestRequestsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportAssemblerService],
  exports: [ReportsService, ReportAssemblerService],
})
export class ReportsModule {}
