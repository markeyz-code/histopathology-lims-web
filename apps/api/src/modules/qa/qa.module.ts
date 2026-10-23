import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { ReportModelName, ReportSchema } from '../reports/report.schema';
import { UserModelName, UserSchema } from '../users/user.schema';
import { QaController } from './qa.controller';
import { QaReviewModelName, QaReviewSchema } from './qa-review.schema';
import { QaService } from './qa.service';

@Module({
  imports: [
    AuditModule,
    NotificationsModule,
    MongooseModule.forFeature([
      { name: QaReviewModelName, schema: QaReviewSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: ReportModelName, schema: ReportSchema },
      { name: UserModelName, schema: UserSchema },
      { name: LabModelName, schema: LabSchema },
    ]),
  ],
  controllers: [QaController],
  providers: [QaService],
  exports: [QaService],
})
export class QaModule {}
