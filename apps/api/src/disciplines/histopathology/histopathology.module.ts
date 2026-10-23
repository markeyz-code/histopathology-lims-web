import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CasesModule } from '../../core/cases/cases.module';
import { ReportPortsModule } from '../../core/reports/report-ports';
import { CustodyModule } from '../../core/custody/custody.module';
import { CustodyPortsModule } from '../../core/custody/custody-ports';
import { AuditModule } from '../../core/audit/audit.module';
import { CaseModelName, CaseSchema } from '../../core/cases/case.schema';
import { PatientModelName, PatientSchema } from '../../core/patients/patient.schema';
import { SpecimenModelName, SpecimenSchema } from '../../core/specimens/specimen.schema';
import { BlockModelName, BlockSchema } from './blocks/block.schema';
import { HistopathologyCaseArtifactsService } from './case-artifacts.service';
import { SlideModelName, SlideSchema } from './slides/slide.schema';
import { ProtocolModelName, ProtocolSchema } from './protocols/protocol.schema';
import { PdfModule } from './pdf/pdf.module';
import { HistopathologyReportPortsService } from './report-ports.service';
import { HistopathologyLabelArtifactsService } from './label-artifacts.service';
import { LabelsModule } from '../../core/labels/labels.module';
import { BarcodeResolverService } from './custody/barcode-resolver.service';
import { HistopathologyCustodyPortsService } from './custody/histopathology-custody-ports.service';
import { LocatorService } from './custody/locator.service';
import { ReportPropagationService } from './custody/report-propagation.service';
import { ScanService } from './custody/scan.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BlockModelName, schema: BlockSchema },
      { name: SlideModelName, schema: SlideSchema },
      { name: ProtocolModelName, schema: ProtocolSchema },
      { name: CaseModelName, schema: CaseSchema },
      { name: PatientModelName, schema: PatientSchema },
      { name: SpecimenModelName, schema: SpecimenSchema },
    ]),
    CasesModule,
    PdfModule,
    ReportPortsModule,
    CustodyModule,
    CustodyPortsModule,
    AuditModule,
    LabelsModule,
  ],
  providers: [
    HistopathologyCaseArtifactsService,
    HistopathologyReportPortsService,
    BarcodeResolverService,
    ScanService,
    LocatorService,
    ReportPropagationService,
    HistopathologyCustodyPortsService,
    HistopathologyLabelArtifactsService,
  ],
})
export class HistopathologyModule {}
