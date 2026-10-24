import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadModelName, LeadSchema } from './lead.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: LeadModelName, schema: LeadSchema }])],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
