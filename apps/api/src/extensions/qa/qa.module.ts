import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../../core/audit/audit.module';
import { CaseModelName, CaseSchema } from '../../core/cases/case.schema';
import { LabModelName, LabSchema } from '../../core/labs/lab.schema';
import { NotificationsModule } from '../../core/notifications/notifications.module';
import { PatientModelName, PatientSchema } from '../../core/patients/patient.schema';
import { ReportModelName, ReportSchema } from '../../core/reports/report.schema';
import { UserModelName, UserSchema } from '../../core/users/user.schema';
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
