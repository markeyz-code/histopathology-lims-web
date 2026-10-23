import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../../core/audit/audit.module';
import { TerminologyController } from './terminology.controller';
import { TerminologyModelName, TerminologySchema } from './terminology.schema';
import { TerminologyService } from './terminology.service';

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([{ name: TerminologyModelName, schema: TerminologySchema }]),
  ],
  controllers: [TerminologyController],
  providers: [TerminologyService],
  exports: [TerminologyService],
})
export class TerminologyModule {}
