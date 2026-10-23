import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockModelName, BlockSchema } from '../blocks/block.schema';
import { CaseModelName, CaseSchema } from '../../../core/cases/case.schema';
import { LabModelName, LabSchema } from '../../../core/labs/lab.schema';
import { PatientModelName, PatientSchema } from '../../../core/patients/patient.schema';
import { ReportModelName, ReportSchema } from '../../../core/reports/report.schema';
import { SpecimenModelName, SpecimenSchema } from '../../../core/specimens/specimen.schema';
import { UserModelName, UserSchema } from '../../../core/users/user.schema';
import { PdfService } from './pdf.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReportModelName, schema: ReportSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: UserModelName, schema: UserSchema },
      { name: LabModelName, schema: LabSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
      { name: BlockModelName, schema: BlockSchema },
    ]),
  ],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
