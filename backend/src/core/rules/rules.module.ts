import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import {
  RuleExecutionModelName,
  RuleExecutionSchema,
  RuleModelName,
  RuleSchema,
} from './rule.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RuleModelName, schema: RuleSchema },
      { name: RuleExecutionModelName, schema: RuleExecutionSchema },
    ]),
    AuditModule,
  ],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
