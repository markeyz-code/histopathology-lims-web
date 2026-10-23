import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../../core/audit/audit.module';
import { CaseModelName, CaseSchema } from '../../core/cases/case.schema';
import { LabsModule } from '../../core/labs/labs.module';
import { PatientModelName, PatientSchema } from '../../core/patients/patient.schema';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { InvoiceModelName, InvoiceSchema } from './invoice.schema';
import { PaymentModelName, PaymentSchema } from './payment.schema';

@Module({
  imports: [
    AuditModule,
    LabsModule,
    MongooseModule.forFeature([
      { name: InvoiceModelName, schema: InvoiceSchema },
      { name: PaymentModelName, schema: PaymentSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
