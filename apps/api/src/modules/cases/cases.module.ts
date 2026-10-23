import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockModelName, BlockSchema } from '../blocks/block.schema';
import { CustodyModule } from '../custody/custody.module';
import { LabsModule } from '../labs/labs.module';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { PatientsModule } from '../patients/patients.module';
import { ReportModelName, ReportSchema } from '../reports/report.schema';
import { ReportsModule } from '../reports/reports.module';
import { SlideModelName, SlideSchema } from '../slides/slide.schema';
import { SpecimenModelName, SpecimenSchema } from '../specimens/specimen.schema';
import { UserModelName, UserSchema } from '../users/user.schema';
import { UsersModule } from '../users/users.module';
import { CaseModelName, CaseSchema } from './case.schema';
import { CasesController } from './cases.controller';
import { CasesService } from './cases.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
      { name: BlockModelName, schema: BlockSchema },
      { name: SlideModelName, schema: SlideSchema },
      { name: ReportModelName, schema: ReportSchema },
      { name: UserModelName, schema: UserSchema },
    ]),
    PatientsModule,
    LabsModule,
    UsersModule,
    CustodyModule,
    ReportsModule,
  ],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
