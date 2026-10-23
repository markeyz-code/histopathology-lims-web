import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LabsModule } from '../labs/labs.module';
import { PatientsController } from './patients.controller';
import { PatientModelName, PatientSchema } from './patient.schema';
import { PatientsService } from './patients.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: PatientModelName, schema: PatientSchema }]),
    LabsModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
