import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type ClientSession } from 'mongoose';
import { ProtocolModelName, type ProtocolEntity } from './protocols/protocol.schema';
import { PdfService } from './pdf/pdf.service';
import { ReportPortRegistry, type ProtocolRecord } from '../../core/reports/report-ports';

@Injectable()
export class HistopathologyReportPortsService implements OnModuleInit {
  constructor(
    @InjectModel(ProtocolModelName) private readonly protocolModel: Model<ProtocolEntity>,
    private readonly pdf: PdfService,
    private readonly registry: ReportPortRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register('HISTOPATHOLOGY', {
      protocols: {
        findById: (protocolId: string, session: ClientSession) =>
          this.findProtocol(protocolId, session),
      },
      renderer: {
        generateAndStore: (reportId) => this.pdf.generateAndStore(reportId),
        getOrGenerate: (reportId) => this.pdf.getOrGenerate(reportId),
      },
    });
  }

  private async findProtocol(
    protocolId: string,
    session: ClientSession,
  ): Promise<ProtocolRecord | null> {
    const protocol = await this.protocolModel.findById(protocolId).session(session).exec();
    return protocol ? (protocol.toObject() as unknown as ProtocolRecord) : null;
  }
}
