import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustodyModule } from '../custody/custody.module';
import { LabsModule } from '../labs/labs.module';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { PatientsModule } from '../patients/patients.module';
import { ReportModelName, ReportSchema } from '../reports/report.schema';
import { ReportsModule } from '../reports/reports.module';
import { SpecimenModelName, SpecimenSchema } from '../specimens/specimen.schema';
import { UserModelName, UserSchema } from '../users/user.schema';
import { UsersModule } from '../users/users.module';
import { TestRequestsModule } from '../test-requests/test-requests.module';
import { CaseModelName, CaseSchema } from './case.schema';
import { CasesController } from './cases.controller';
import { CaseArtifactRegistry } from './case-artifacts';
import { CasesService } from './cases.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
      { name: ReportModelName, schema: ReportSchema },
      { name: UserModelName, schema: UserSchema },
    ]),
    PatientsModule,
    LabsModule,
    UsersModule,
    CustodyModule,
    ReportsModule,
    TestRequestsModule,
  ],
  controllers: [CasesController],
  providers: [CasesService, CaseArtifactRegistry],
  exports: [CasesService, CaseArtifactRegistry],
})
export class CasesModule {}
