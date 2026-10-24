import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../../core/cases/case.schema';
import { CasesModule } from '../../core/cases/cases.module';
import { LabModelName, LabSchema } from '../../core/labs/lab.schema';
import { PatientModelName, PatientSchema } from '../../core/patients/patient.schema';
import { ReportModelName, ReportSchema } from '../../core/reports/report.schema';
import { UserModelName, UserSchema } from '../../core/users/user.schema';
import { Hl7Controller } from './hl7.controller';
import { Hl7Service } from './hl7.service';
import { MllpServer } from './mllp.server';

@Module({
  imports: [
    CasesModule,
    MongooseModule.forFeature([
      { name: LabModelName, schema: LabSchema },
      { name: UserModelName, schema: UserSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: ReportModelName, schema: ReportSchema },
    ]),
  ],
  controllers: [Hl7Controller],
  providers: [Hl7Service, MllpServer],
  exports: [Hl7Service],
})
export class Hl7Module {}
