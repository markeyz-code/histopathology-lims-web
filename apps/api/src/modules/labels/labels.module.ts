import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockModelName, BlockSchema } from '../blocks/block.schema';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { LabModelName, LabSchema } from '../labs/lab.schema';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { SlideModelName, SlideSchema } from '../slides/slide.schema';
import { SpecimenModelName, SpecimenSchema } from '../specimens/specimen.schema';
import { LabelsController } from './labels.controller';
import { LabelsService } from './labels.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
      { name: BlockModelName, schema: BlockSchema },
      { name: SlideModelName, schema: SlideSchema },
      { name: LabModelName, schema: LabSchema },
    ]),
  ],
  controllers: [LabelsController],
  providers: [LabelsService],
  exports: [LabelsService],
})
export class LabelsModule {}
