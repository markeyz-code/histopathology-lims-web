import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CasesModule } from '../cases/cases.module';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { CustodyEventModelName, CustodyEventSchema } from '../custody/custody-event.schema';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { UserModelName, UserSchema } from '../users/user.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: UserModelName, schema: UserSchema },
      { name: CustodyEventModelName, schema: CustodyEventSchema },
    ]),
    CasesModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
