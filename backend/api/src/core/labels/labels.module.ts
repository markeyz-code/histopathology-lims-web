import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { SpecimenModelName, SpecimenSchema } from '../specimens/specimen.schema';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';
import { LabelArtifactRegistry } from './label-artifacts';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
      { name: LabModelName, schema: LabSchema },
    ]),
  ],
  controllers: [LabelsController],
  providers: [LabelsService, LabelArtifactRegistry],
  exports: [LabelsService, LabelArtifactRegistry],
})
export class LabelsModule {}
