import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import {
  PanelModelName,
  PanelSchema,
  TestDefinitionModelName,
  TestDefinitionSchema,
} from './test-definition.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestDefinitionModelName, schema: TestDefinitionSchema },
      { name: PanelModelName, schema: PanelSchema },
    ]),
    AuditModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
