import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CasesModule } from '../cases/cases.module';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { LabsModule } from '../labs/labs.module';
import { SlideModelName, SlideSchema } from '../slides/slide.schema';
import { WorklistController } from './worklist.controller';
import { WorklistService } from './worklist.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CaseModelName, schema: CaseSchema },
      { name: SlideModelName, schema: SlideSchema },
    ]),
    CasesModule,
    LabsModule,
  ],
  controllers: [WorklistController],
  providers: [WorklistService],
})
export class WorklistModule {}
