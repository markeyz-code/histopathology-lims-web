import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { CustodyModule } from '../custody/custody.module';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { PdfModule } from '../pdf/pdf.module';
import { ReportAssemblerService } from '../reports/report-assembler.service';
import { ReportVersionModelName, ReportVersionSchema } from '../reports/report-version.schema';
import { ReportModelName, ReportSchema } from '../reports/report.schema';
import { UserModelName, UserSchema } from '../users/user.schema';
import { PortalTokenModelName, PortalTokenSchema } from './portal-token.schema';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [
    AuthModule,
    CustodyModule,
    PdfModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: PortalTokenModelName, schema: PortalTokenSchema },
      { name: UserModelName, schema: UserSchema },
      { name: LabModelName, schema: LabSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: ReportModelName, schema: ReportSchema },
      { name: ReportVersionModelName, schema: ReportVersionSchema },
    ]),
  ],
  controllers: [PortalController],
  providers: [PortalService, ReportAssemblerService],
})
export class PortalModule {}
