import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlockModelName, BlockSchema } from '../blocks/block.schema';
import { CaseModelName, CaseSchema } from '../cases/case.schema';
import { PatientModelName, PatientSchema } from '../patients/patient.schema';
import { SlideModelName, SlideSchema } from '../slides/slide.schema';
import { SpecimenModelName, SpecimenSchema } from '../specimens/specimen.schema';
import { BarcodeResolverService } from './barcode-resolver.service';
import { CaseWorkflowService } from './case-workflow.service';
import { CustodyController } from './custody.controller';
import { CustodyEventModelName, CustodyEventSchema } from './custody-event.schema';
import { CustodyService } from './custody.service';
import { LocatorService } from './locator.service';
import { ReportPropagationService } from './report-propagation.service';
import { ScanService } from './scan.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustodyEventModelName, schema: CustodyEventSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
      { name: BlockModelName, schema: BlockSchema },
      { name: SlideModelName, schema: SlideSchema },
      { name: PatientModelName, schema: PatientSchema },
    ]),
  ],
  controllers: [CustodyController],
  providers: [
    CustodyService,
    CaseWorkflowService,
    BarcodeResolverService,
    ScanService,
    LocatorService,
    ReportPropagationService,
  ],
  exports: [
    CustodyService,
    CaseWorkflowService,
    BarcodeResolverService,
    ReportPropagationService,
    ScanService,
    LocatorService,
  ],
})
export class CustodyModule {}
