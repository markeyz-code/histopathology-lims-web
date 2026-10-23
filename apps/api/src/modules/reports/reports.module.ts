import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { CustodyModule } from '../custody/custody.module';
import { JobsModule } from '../jobs/jobs.module';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { PdfModule } from '../pdf/pdf.module';
import { ProtocolModelName, ProtocolSchema } from '../protocols/protocol.schema';
import { QaModule } from '../qa/qa.module';
import { TerminologyModule } from '../terminology/terminology.module';
import { UserModelName, UserSchema } from '../users/user.schema';
import { ReportAssemblerService } from './report-assembler.service';
import { ReportVersionModelName, ReportVersionSchema } from './report-version.schema';
import { ReportModelName, ReportSchema } from './report.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportModelName, schema: ReportSchema },
      { name: ReportVersionModelName, schema: ReportVersionSchema },
      { name: ProtocolModelName, schema: ProtocolSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: UserModelName, schema: UserSchema },
      { name: LabModelName, schema: LabSchema },
    ]),
    CustodyModule,
    PdfModule,
    JobsModule,
    QaModule,
    TerminologyModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportAssemblerService],
  exports: [ReportsService, ReportAssemblerService],
})
export class ReportsModule {}
