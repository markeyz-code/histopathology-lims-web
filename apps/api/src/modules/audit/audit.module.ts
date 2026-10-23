import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditController } from './audit.controller';
import { AuditLogModelName, AuditLogSchema } from './audit-log.schema';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AuditLogModelName, schema: AuditLogSchema }])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
