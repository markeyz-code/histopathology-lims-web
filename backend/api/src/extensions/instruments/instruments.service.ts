import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { InstrumentMessage } from '@lims/shared';
import { LabModelName, type LabEntity } from '../../core/labs/lab.schema';
import {
  TestRequestModelName,
  type TestRequestEntity,
} from '../../core/test-requests/test-request.schema';
import { currentTenant } from '../../common/context/tenant-context';
import { parseInstrumentMessage } from './instrument.parser';
import { InstrumentMessageModelName, type InstrumentMessageEntity } from './instrument.schema';

@Injectable()
export class InstrumentsService {
  constructor(
    @InjectModel(InstrumentMessageModelName)
    private readonly messageModel: Model<InstrumentMessageEntity>,
    @InjectModel(TestRequestModelName) private readonly requestModel: Model<TestRequestEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
  ) {}

  async ingest(protocol: 'ASTM' | 'HL7', raw: string): Promise<InstrumentMessage> {
    if (!raw.trim()) throw new BadRequestException('An instrument message is required.');
    const tenant = currentTenant();
    const lab = tenant ? await this.labModel.findById(tenant.labId).exec() : null;
    const parsed = parseInstrumentMessage(protocol, raw);
    const request = parsed.accessionNumber
      ? await this.requestModel.findOne({ accessionNumber: parsed.accessionNumber }).exec()
      : null;
    const message = await this.messageModel.create({
      protocol,
      labCode: lab?.code ?? null,
      accessionNumber: parsed.accessionNumber,
      testCode: parsed.testCode,
      patientName: parsed.patientName,
      values: parsed.values,
      status: request ? 'MATCHED' : 'UNMATCHED',
      error: request ? null : 'No matching accession in this laboratory.',
      rawMessage: raw,
    });
    return this.toMessage(message);
  }

  async list(): Promise<InstrumentMessage[]> {
    const rows = await this.messageModel.find({}).sort({ createdAt: -1 }).limit(100).exec();
    return rows.map((row) => this.toMessage(row));
  }

  private toMessage(row: InstrumentMessageEntity): InstrumentMessage {
    return {
      id: row._id.toString(),
      protocol: row.protocol,
      labCode: row.labCode,
      accessionNumber: row.accessionNumber,
      testCode: row.testCode,
      patientName: row.patientName,
      values: row.values,
      status: row.status,
      error: row.error,
      rawMessage: row.rawMessage,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
