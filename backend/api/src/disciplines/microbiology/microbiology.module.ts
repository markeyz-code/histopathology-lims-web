import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../../core/audit/audit.module';
import { CaseModelName, CaseSchema } from '../../core/cases/case.schema';
import { PatientModelName, PatientSchema } from '../../core/patients/patient.schema';
import { TestRequestsModule } from '../../core/test-requests/test-requests.module';
import {
  TestRequestModelName,
  TestRequestSchema,
} from '../../core/test-requests/test-request.schema';
import { MicrobiologyController } from './microbiology.controller';
import { MicrobiologyService } from './microbiology.service';
import {
  AntibioticModelName,
  AntibioticSchema,
  BreakpointModelName,
  BreakpointSchema,
  CultureModelName,
  CultureSchema,
  IsolateModelName,
  IsolateSchema,
  OrganismModelName,
  OrganismSchema,
  SusceptibilityModelName,
  SusceptibilitySchema,
} from './microbiology.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OrganismModelName, schema: OrganismSchema },
      { name: AntibioticModelName, schema: AntibioticSchema },
      { name: BreakpointModelName, schema: BreakpointSchema },
      { name: CultureModelName, schema: CultureSchema },
      { name: IsolateModelName, schema: IsolateSchema },
      { name: SusceptibilityModelName, schema: SusceptibilitySchema },
      { name: TestRequestModelName, schema: TestRequestSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
    ]),
    TestRequestsModule,
    AuditModule,
  ],
  controllers: [MicrobiologyController],
  providers: [MicrobiologyService],
  exports: [MicrobiologyService],
})
export class MicrobiologyModule {}
