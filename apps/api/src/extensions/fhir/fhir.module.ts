import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../../core/cases/case.schema';
import { LabModelName, LabSchema } from '../../core/labs/lab.schema';
import { PatientModelName, PatientSchema } from '../../core/patients/patient.schema';
import { ReportModelName, ReportSchema } from '../../core/reports/report.schema';
import { SpecimenModelName, SpecimenSchema } from '../../core/specimens/specimen.schema';
import { FhirController } from './fhir.controller';
import { FhirService } from './fhir.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PatientModelName, schema: PatientSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
      { name: ReportModelName, schema: ReportSchema },
      { name: LabModelName, schema: LabSchema },
    ]),
  ],
  controllers: [FhirController],
  providers: [FhirService],
})
export class FhirModule {}
