import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../../core/auth/auth.module';
import { CaseModelName, CaseSchema } from '../../core/cases/case.schema';
import { CustodyModule } from '../../core/custody/custody.module';
import { LabModelName, LabSchema } from '../../core/labs/lab.schema';
import { NotificationsModule } from '../../core/notifications/notifications.module';
import { PatientModelName, PatientSchema } from '../../core/patients/patient.schema';
import { PdfModule } from '../../disciplines/histopathology/pdf/pdf.module';
import { ResultsModule } from '../../core/results/results.module';
import { ResultSetModelName, ResultSetSchema } from '../../core/results/result.schema';
import { ReportAssemblerService } from '../../core/reports/report-assembler.service';
import {
  ReportVersionModelName,
  ReportVersionSchema,
} from '../../core/reports/report-version.schema';
import { ReportModelName, ReportSchema } from '../../core/reports/report.schema';
import { UserModelName, UserSchema } from '../../core/users/user.schema';
import { PortalTokenModelName, PortalTokenSchema } from './portal-token.schema';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [
    AuthModule,
    CustodyModule,
    PdfModule,
    ResultsModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: PortalTokenModelName, schema: PortalTokenSchema },
      { name: UserModelName, schema: UserSchema },
      { name: LabModelName, schema: LabSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: ReportModelName, schema: ReportSchema },
      { name: ReportVersionModelName, schema: ReportVersionSchema },
      { name: ResultSetModelName, schema: ResultSetSchema },
    ]),
  ],
  controllers: [PortalController],
  providers: [PortalService, ReportAssemblerService],
})
export class PortalModule {}
