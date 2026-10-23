import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';
import type { LabelFormat, LabelSymbology } from '@lims/shared';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { SpecimenModelName, type SpecimenEntity } from '../specimens/specimen.schema';
import type { LabelInclude } from './dto/label.dto';
import { LabelArtifactRegistry, type LabelArtifact } from './label-artifacts';

interface LabelData {
  barcode: string;
  label: string;
  accession: string;
  labCode: string;
  patientName: string;
  detail: string;
  date: string;
  kind: 'SPECIMEN' | 'BLOCK' | 'SLIDE';
}

export interface LabelResult {
  body: Buffer | string;
  contentType: string;
  filename: string;
}

const LABEL_WIDTH = 141.73;
const LABEL_HEIGHT = 70.87;

@Injectable()
export class LabelsService {
  constructor(
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    private readonly labelArtifacts: LabelArtifactRegistry,
  ) {}

  async entityLabel(
    entityType: string,
    id: string,
    format: LabelFormat,
    symbology: LabelSymbology,
  ): Promise<LabelResult> {
    const type = entityType.toUpperCase();
    if (type !== 'SPECIMEN' && type !== 'BLOCK' && type !== 'SLIDE') {
      throw new BadRequestException('Label entity type must be specimen, block or slide.');
    }
    const objectId = new Types.ObjectId(id);

    if (type === 'SPECIMEN') {
      const specimen = await this.specimenModel.findById(objectId).exec();
      if (!specimen) throw new NotFoundException('Specimen not found.');
      const [caseDoc, lab] = await Promise.all([
        this.caseModel.findById(specimen.caseId).exec(),
        this.caseModel
          .findById(specimen.caseId)
          .then((found) => (found ? this.labModel.findById(found.labId).exec() : null)),
      ]);
      if (!caseDoc) throw new NotFoundException('Case not found.');
      const patient = await this.patientModel.findById(caseDoc.patientId).exec();
      if (!lab) throw new NotFoundException('Laboratory not found.');
      const data = this.specimenLabel(specimen, caseDoc, patient, lab);
      return this.render([data], format, symbology, caseDoc.accessionNumber);
    }

    const artifact = await this.artifact(type, id);
    if (!artifact)
      throw new NotFoundException(`${type === 'BLOCK' ? 'Block' : 'Slide'} not found.`);
    const [caseDoc, lab] = await Promise.all([
      this.caseModel.findById(artifact.caseId).exec(),
      this.caseModel
        .findById(artifact.caseId)
        .then((found) => (found ? this.labModel.findById(found.labId).exec() : null)),
    ]);
    if (!caseDoc || !lab) throw new NotFoundException('Cannot resolve label.');
    const patient = await this.patientModel.findById(caseDoc.patientId).exec();
    return this.render(
      [this.artifactLabel(artifact, caseDoc, patient, lab)],
      format,
      symbology,
      caseDoc.accessionNumber,
    );
  }

  async caseLabels(
    caseId: string,
    format: LabelFormat,
    symbology: LabelSymbology,
    include: LabelInclude = 'all',
  ): Promise<LabelResult> {
    const caseDoc = await this.caseModel.findById(caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    const [patient, lab, specimens, artifacts] = await Promise.all([
      this.patientModel.findById(caseDoc.patientId).exec(),
      this.labModel.findById(caseDoc.labId).exec(),
      this.specimenModel.find({ caseId: caseDoc._id }).sort({ sequence: 1 }).exec(),
      this.labelArtifacts.forCase(caseDoc._id.toString()),
    ]);
    if (!lab) throw new NotFoundException('Laboratory not found.');

    const labels: LabelData[] = [];
    if (include === 'all' || include === 'specimens') {
      for (const specimen of specimens) {
        labels.push(this.specimenLabel(specimen, caseDoc, patient, lab));
      }
    }
    for (const artifact of artifacts) {
      if (
        include === 'all' ||
        (include === 'blocks' && artifact.kind === 'BLOCK') ||
        (include === 'slides' && artifact.kind === 'SLIDE')
      ) {
        labels.push(this.artifactLabel(artifact, caseDoc, patient, lab));
      }
    }
    if (labels.length === 0) {
      throw new NotFoundException('No printable labels exist for this case yet.');
    }
    return this.render(labels, format, symbology, caseDoc.accessionNumber);
  }

  private specimenLabel(
    specimen: SpecimenEntity,
    caseDoc: CaseEntity,
    patient: PatientEntity | null,
    lab: LabEntity,
  ): LabelData {
    return {
      barcode: specimen.barcode,
      label: specimen.label,
      accession: caseDoc.accessionNumber,
      labCode: lab.code,
      patientName: patient ? this.patientName(patient) : '',
      detail: `${specimen.specimenType} · ${specimen.site}`,
      date: this.date(specimen.receivedAt ?? specimen.createdAt),
      kind: 'SPECIMEN',
    };
  }

  private artifactLabel(
    artifact: LabelArtifact,
    caseDoc: CaseEntity,
    patient: PatientEntity | null,
    lab: LabEntity,
  ): LabelData {
    return {
      barcode: artifact.barcode,
      label: artifact.label,
      accession: caseDoc.accessionNumber,
      labCode: lab.code,
      patientName: patient ? this.patientName(patient) : '',
      detail: artifact.detail,
      date: this.date(artifact.date),
      kind: artifact.kind,
    };
  }

  private async artifact(type: string, id: string): Promise<LabelArtifact | null> {
    const provider = this.labelArtifacts.get();
    if (!provider) throw new NotFoundException('No label provider is registered.');
    return provider.entity(type as 'BLOCK' | 'SLIDE', id);
  }

  private async render(
    labels: LabelData[],
    format: LabelFormat,
    symbology: LabelSymbology,
    accession: string,
  ): Promise<LabelResult> {
    if (format === 'zpl') {
      return {
        body: labels.map((label) => this.zpl(label, symbology)).join('\n'),
        contentType: 'text/plain; charset=utf-8',
        filename: `${accession}-labels.zpl`,
      };
    }
    if (format === 'svg') {
      if (labels.length !== 1) {
        throw new BadRequestException('SVG preview supports one label at a time.');
      }
      const svg = await this.svg(labels[0]!, symbology);
      return {
        body: svg,
        contentType: 'image/svg+xml; charset=utf-8',
        filename: `${accession}-${labels[0]?.label ?? 'label'}.svg`,
      };
    }
    const body = await this.pdf(labels, symbology);
    return {
      body,
      contentType: 'application/pdf',
      filename: `${accession}-labels.pdf`,
    };
  }

  private async symbol(barcode: string, symbology: LabelSymbology): Promise<Buffer> {
    return bwipjs.toBuffer({
      bcid: symbology === 'qr' ? 'qrcode' : 'datamatrix',
      text: barcode,
      scale: 4,
      height: symbology === 'qr' ? 12 : 12,
      includetext: false,
      backgroundcolor: 'FFFFFF',
      padding: 1,
    });
  }

  private async pdf(labels: LabelData[], symbology: LabelSymbology): Promise<Buffer> {
    const doc = new PDFDocument({
      size: [LABEL_WIDTH, LABEL_HEIGHT],
      margin: 0,
      autoFirstPage: false,
      info: { Title: 'Histopathology labels', Creator: 'Histopathology LIMS' },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<void>((resolve, reject) => {
      doc.on('end', () => resolve());
      doc.on('error', (error) => reject(error));
    });

    for (const label of labels) {
      doc.addPage({ size: [LABEL_WIDTH, LABEL_HEIGHT], margin: 0 });
      doc
        .rect(1, 1, LABEL_WIDTH - 2, LABEL_HEIGHT - 2)
        .strokeColor('#A8A29A')
        .lineWidth(0.4)
        .stroke();
      const png = await this.symbol(label.barcode, symbology);
      doc.image(png, 4, 14, { fit: [44, 44] });
      doc
        .font('Helvetica-Bold')
        .fontSize(5.4)
        .fillColor('#5F6663')
        .text(`${label.labCode} · ${label.accession}`, 52, 5, { width: 86 });
      doc
        .font('Helvetica-Bold')
        .fontSize(15)
        .fillColor('#171A1C')
        .text(label.label, 52, 14, { width: 50 });
      doc
        .font('Helvetica-Bold')
        .fontSize(5.2)
        .fillColor('#171A1C')
        .text(label.detail.toUpperCase(), 52, 37, { width: 86, height: 15, ellipsis: true });
      doc
        .font('Helvetica')
        .fontSize(5.2)
        .fillColor('#3E4642')
        .text(this.ascii(label.patientName), 52, 50, { width: 86, ellipsis: true });
      doc
        .font('Courier')
        .fontSize(4.6)
        .fillColor('#5F6663')
        .text(label.barcode, 52, 61, { width: 86, ellipsis: true });
      doc
        .font('Helvetica')
        .fontSize(4.4)
        .fillColor('#7A817C')
        .text(label.date, 4, 61, { width: 44, align: 'center' });
    }
    doc.end();
    await finished;
    return Buffer.concat(chunks);
  }

  private zpl(label: LabelData, symbology: LabelSymbology): string {
    const safe = (value: string) => this.ascii(value).replace(/[\^~\\]/g, ' ');
    const symbol =
      symbology === 'qr'
        ? `^FO20,40^BQN,2,5^FDQA,${safe(label.barcode)}^FS`
        : `^FO20,64^BXN,5,200,0,0,1^FD${safe(label.barcode)}^FS`;
    return [
      '^XA',
      '^PW400',
      '^LL203',
      '^CI28',
      symbol,
      `^FO170,16^A0N,20,20^FD${safe(label.labCode)} ${safe(label.accession)}^FS`,
      `^FO170,42^A0N,38,38^FD${safe(label.label)}^FS`,
      `^FO170,88^A0N,15,15^FD${safe(label.detail).slice(0, 36)}^FS`,
      `^FO170,108^A0N,15,15^FD${safe(label.patientName).slice(0, 36)}^FS`,
      `^FO170,132^A0N,13,13^FD${safe(label.barcode)}^FS`,
      `^FO170,156^A0N,13,13^FD${safe(label.date)}^FS`,
      '^XZ',
    ].join('\n');
  }

  private async svg(label: LabelData, symbology: LabelSymbology): Promise<string> {
    const symbolSvg = bwipjs.toSVG({
      bcid: symbology === 'qr' ? 'qrcode' : 'datamatrix',
      text: label.barcode,
      scale: 3,
      padding: 1,
      backgroundcolor: 'FFFFFF',
    });
    const encoded = Buffer.from(symbolSvg, 'utf8').toString('base64');
    const escape = (value: string) =>
      value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="250" viewBox="0 0 500 250" role="img" aria-label="Label for ${escape(label.label)} ${escape(label.barcode)}">
  <rect width="500" height="250" fill="#ffffff"/>
  <rect x="4" y="4" width="492" height="242" fill="none" stroke="#a8a29a" stroke-width="2"/>
  <image href="data:image/svg+xml;base64,${encoded}" x="16" y="52" width="156" height="156"/>
  <g font-family="Helvetica, Arial, sans-serif" fill="#171a1c">
    <text x="190" y="34" font-size="18" font-weight="700" fill="#5f6663">${escape(label.labCode)} · ${escape(label.accession)}</text>
    <text x="190" y="88" font-size="54" font-weight="700">${escape(label.label)}</text>
    <text x="190" y="124" font-size="17" font-weight="700">${escape(label.detail.toUpperCase()).slice(0, 44)}</text>
    <text x="190" y="150" font-size="17">${escape(label.patientName).slice(0, 44)}</text>
    <text x="190" y="190" font-family="monospace" font-size="14" fill="#5f6663">${escape(label.barcode)}</text>
    <text x="190" y="218" font-size="14" fill="#7a817c">${escape(label.date)}</text>
    <text x="16" y="232" font-size="13" fill="#7a817c">${escape(label.kind)}</text>
  </g>
</svg>`;
  }

  private patientName(patient: PatientEntity): string {
    return `${patient.firstName} ${patient.lastName}`.toUpperCase();
  }

  private date(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private ascii(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, '');
  }
}
