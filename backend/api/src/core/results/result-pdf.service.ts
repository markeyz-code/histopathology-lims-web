import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import type { CumulativeReport } from '@lims/shared';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';
import { ResultSetModelName, type ResultSetEntity } from './result.schema';

const INK = '#1A1D1F';
const MUTED = '#68706B';
const ACCENT = '#B8391D';
const LINE = '#D8D3C7';

export interface ResultPdf {
  path: string;
  filename: string;
}

@Injectable()
export class ResultPdfService {
  constructor(
    @InjectModel(ResultSetModelName) private readonly resultModel: Model<ResultSetEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    private readonly config: ConfigService,
  ) {}

  async generateAndStore(resultId: string): Promise<ResultPdf> {
    const result = await this.resultModel.findById(resultId).exec();
    if (!result) throw new NotFoundException('Result not found.');
    if (result.status !== 'VERIFIED' && result.status !== 'RELEASED') {
      throw new BadRequestException('Only a verified or released result can be printed.');
    }
    const [caseDoc, patient, lab, verifier] = await Promise.all([
      this.caseModel.findById(result.caseId).exec(),
      this.patientModel.findById(result.patientId).exec(),
      this.caseModel
        .findById(result.caseId)
        .then((found) => (found ? this.labModel.findById(found.labId).exec() : null)),
      result.verifiedBy ? this.userModel.findById(result.verifiedBy).exec() : null,
    ]);
    if (!caseDoc || !patient || !lab) throw new NotFoundException('Result context is incomplete.');
    const buffer = await this.renderResult({ result, caseDoc, patient, lab, verifier });
    return this.store(
      buffer,
      lab._id.toString(),
      `${caseDoc.accessionNumber}-${result.testCode}-result.pdf`,
      'results',
    );
  }

  async generateCumulative(report: CumulativeReport, labId: string): Promise<ResultPdf> {
    const lab = await this.labModel.findById(labId).exec();
    const buffer = await this.renderCumulative(report, lab);
    return this.store(buffer, labId, `${report.patient.mrn}-cumulative.pdf`, 'cumulative');
  }

  private async renderResult(input: {
    result: ResultSetEntity;
    caseDoc: CaseEntity;
    patient: PatientEntity;
    lab: LabEntity;
    verifier: UserEntity | null;
  }): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );
    const { result, caseDoc, patient, lab, verifier } = input;
    this.letterhead(doc, lab);
    doc.moveDown(1.4);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text('Diagnostic result report');
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(9)
      .text(
        `${result.discipline.replace('_', ' ')} · ${result.testCode} · Version ${result.currentVersion}`,
      );
    doc.moveDown(0.8);
    this.detailRow(doc, 'Patient', `${patient.firstName} ${patient.lastName}`, 'MRN', patient.mrn);
    this.detailRow(
      doc,
      'Accession',
      caseDoc.accessionNumber,
      'Received',
      caseDoc.receivedAt.toISOString().slice(0, 10),
    );
    doc.moveDown(0.5);
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor(LINE).stroke();
    doc.moveDown(0.8);
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(11).text(result.testName.toUpperCase());
    doc.moveDown(0.7);
    const tableTop = doc.y;
    const columns = [48, 210, 330, 400, 490];
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(8);
    doc
      .text('Analyte', columns[0]!, tableTop)
      .text('Result', columns[1]!, tableTop)
      .text('Reference', columns[2]!, tableTop)
      .text('Flag', columns[3]!, tableTop);
    doc.moveDown(0.5);
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor(LINE).stroke();
    doc.moveDown(0.35);
    for (const value of result.values) {
      const y = doc.y;
      const critical = value.flag === 'CRITICAL_LOW' || value.flag === 'CRITICAL_HIGH';
      doc.fillColor(INK).font('Helvetica').fontSize(9);
      doc.text(value.analyteName ?? value.analyteKey, columns[0]!, y, { width: 150 });
      doc.text(`${value.value ?? '—'} ${value.unit ?? ''}`, columns[1]!, y, { width: 105 });
      doc.fillColor(MUTED).text(value.referenceText ?? '—', columns[2]!, y, { width: 60 });
      doc
        .fillColor(critical ? '#B8391D' : value.flag === 'NORMAL' ? MUTED : '#9A6411')
        .font('Helvetica-Bold')
        .text(value.flag.replace('_', ' '), columns[3]!, y, { width: 90 });
      doc.moveDown(0.4);
    }
    doc.moveDown(0.8);
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor(LINE).stroke();
    doc.moveDown(0.8);
    if (result.comment) {
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text('Comment');
      doc.fillColor(INK).font('Helvetica').fontSize(9).text(result.comment, { width: 480 });
      doc.moveDown(0.8);
    }
    doc.fillColor(MUTED).font('Helvetica').fontSize(8);
    doc.text(
      `Verified by ${verifier?.name ?? 'Laboratory scientist'} · ${result.verifiedAt?.toISOString().slice(0, 16).replace('T', ' ') ?? '—'}`,
    );
    if (result.releasedAt)
      doc.text(`Released ${result.releasedAt.toISOString().slice(0, 16).replace('T', ' ')}`);
    doc.moveDown(1.2);
    this.footer(doc, lab);
    doc.end();
    return done;
  }

  private async renderCumulative(report: CumulativeReport, lab: LabEntity | null): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );
    this.letterhead(doc, lab);
    doc.moveDown(1.2);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text('Cumulative laboratory report');
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(9)
      .text(`${report.patient.firstName} ${report.patient.lastName} · ${report.patient.mrn}`);
    doc.moveDown(0.8);
    for (const group of report.results) {
      if (doc.y > 690) doc.addPage();
      doc
        .fillColor(ACCENT)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(`${group.testName} · ${group.discipline.replace('_', ' ')}`);
      const top = doc.y + 6;
      const columns = [48, 250, 340, 430];
      doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7);
      doc
        .text('Analyte', columns[0]!, top)
        .text('Latest', columns[1]!, top)
        .text('Reference', columns[2]!, top)
        .text('Flag', columns[3]!, top);
      doc.moveDown(0.5);
      for (const value of group.latest.values) {
        const y = doc.y;
        doc.fillColor(INK).font('Helvetica').fontSize(8);
        doc.text(value.analyteName ?? value.analyteKey, columns[0]!, y, { width: 180 });
        doc.text(`${value.value ?? '—'} ${value.unit ?? ''}`, columns[1]!, y, { width: 80 });
        doc.fillColor(MUTED).text(value.referenceText ?? '—', columns[2]!, y, { width: 80 });
        doc
          .fillColor(value.critical ? '#B8391D' : MUTED)
          .font('Helvetica-Bold')
          .text(value.flag.replace('_', ' '), columns[3]!, y, { width: 80 });
        doc.moveDown(0.35);
      }
      doc.moveDown(0.7);
    }
    this.footer(doc, lab);
    doc.end();
    return done;
  }

  private letterhead(doc: PDFKit.PDFDocument, lab: LabEntity | null): void {
    doc.rect(48, 42, 5, 34).fill(ACCENT);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(lab?.name ?? 'Laboratory', 60, 44);
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text([lab?.address, lab?.phone, lab?.email].filter(Boolean).join(' · '), 60, 61, {
        width: 450,
      });
  }

  private detailRow(
    doc: PDFKit.PDFDocument,
    labelA: string,
    valueA: string,
    labelB: string,
    valueB: string,
  ): void {
    const y = doc.y;
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(labelA, 48, y);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(valueA, 100, y - 1);
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(labelB, 330, y);
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(valueB, 380, y - 1);
    doc.y = y + 18;
  }

  private footer(doc: PDFKit.PDFDocument, lab: LabEntity | null): void {
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(7)
      .text(
        `${lab?.name ?? 'Laboratory'} · This is a laboratory-generated diagnostic result. Verify with the issuing laboratory.`,
        48,
        790,
        { width: 500, align: 'center' },
      );
  }

  private async store(
    buffer: Buffer,
    labId: string,
    filename: string,
    folder: string,
  ): Promise<ResultPdf> {
    const dir = path.resolve(this.config.get<string>('STORAGE_DIR') ?? './storage', folder, labId);
    await mkdir(dir, { recursive: true });
    const safe = filename.replace(/[^A-Za-z0-9_.-]/g, '_');
    const filePath = path.join(dir, `${Date.now()}-${safe}`);
    await writeFile(filePath, buffer);
    return { path: filePath, filename: safe };
  }
}
