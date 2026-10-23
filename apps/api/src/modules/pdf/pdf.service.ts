import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Model } from 'mongoose';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { flattenProtocolFields, generateNarrative, type ProtocolContent } from '@lims/shared';
import { BlockModelName, type BlockEntity } from '../blocks/block.schema';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { SpecimenModelName, type SpecimenEntity } from '../specimens/specimen.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';
import { ReportModelName, type ReportEntity } from '../reports/report.schema';

const INK = '#1A1D1F';
const MUTED = '#68706B';
const ACCENT = '#B8391D';
const LINE = '#D8D3C7';
const BONE = '#F4F1EA';
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export interface GeneratedPdf {
  path: string;
  filename: string;
  version: number;
}

@Injectable()
export class PdfService {
  private readonly fontRegular: string;
  private readonly fontBold: string;
  private readonly fontItalic: string;

  constructor(
    @InjectModel(ReportModelName) private readonly reportModel: Model<ReportEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    @InjectModel(BlockModelName) private readonly blockModel: Model<BlockEntity>,
    private readonly config: ConfigService,
  ) {
    const fontDir = path.resolve(__dirname, '..', '..', 'assets', 'fonts');
    this.fontRegular = path.join(fontDir, 'NotoSans-Regular.ttf');
    this.fontBold = path.join(fontDir, 'NotoSans-Bold.ttf');
    this.fontItalic = path.join(fontDir, 'NotoSans-Italic.ttf');
  }

  async generateAndStore(reportId: string): Promise<GeneratedPdf> {
    const report = await this.reportModel.findById(reportId).exec();
    if (!report) throw new NotFoundException('Report not found.');
    const caseDoc = await this.caseModel.findById(report.caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found for this report.');
    const patient = await this.patientModel.findById(caseDoc.patientId).exec();
    if (!patient) throw new NotFoundException('Patient not found for this case.');
    const lab = await this.labModel.findById(caseDoc.labId).exec();
    if (!lab) throw new NotFoundException('Laboratory not found.');

    const signer = report.signedOutBy
      ? await this.userModel.findById(report.signedOutBy).exec()
      : caseDoc.assignedPathologistId
        ? await this.userModel.findById(caseDoc.assignedPathologistId).exec()
        : null;

    const [specimens, blocks] = await Promise.all([
      this.specimenModel.find({ caseId: caseDoc._id }).sort({ sequence: 1 }).exec(),
      this.blockModel
        .find({ caseId: caseDoc._id })
        .sort({ specimenSequence: 1, blockNumber: 1 })
        .exec(),
    ]);

    const version = report.version > 0 ? report.version : 0;
    const content = report.protocolSnapshot.content as ProtocolContent;
    const publicWeb = this.config.get<string>('PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const verifyUrl = report.verificationCode
      ? `${publicWeb.replace(/\/$/, '')}/verify/${report.verificationCode}`
      : null;
    const qrBuffer = verifyUrl
      ? await QRCode.toBuffer(verifyUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      : null;

    const buffer = await this.renderPdf({
      report,
      caseDoc,
      patient,
      lab,
      signer,
      specimens,
      blocks,
      content,
      qrBuffer,
    });

    const storageDir = path.resolve(
      this.config.get<string>('STORAGE_DIR') ?? './storage',
      'reports',
      caseDoc.labId.toString(),
    );
    await mkdir(storageDir, { recursive: true });
    const filename = `${caseDoc.accessionNumber.replace(/[^A-Za-z0-9_-]/g, '_')}-v${version || 'draft'}.pdf`;
    const filePath = path.join(storageDir, `${report._id.toString()}-v${version}.pdf`);
    await writeFile(filePath, buffer);

    await this.reportModel
      .updateOne({ _id: report._id }, { $set: { pdfPath: filePath, pdfGeneratedAt: new Date() } })
      .exec();

    return { path: filePath, filename, version };
  }

  async getOrGenerate(reportId: string): Promise<GeneratedPdf> {
    const report = await this.reportModel.findById(reportId).exec();
    if (!report) throw new NotFoundException('Report not found.');
    if (report.pdfPath && existsSync(report.pdfPath)) {
      const caseDoc = await this.caseModel.findById(report.caseId).exec();
      const filename = `${(caseDoc?.accessionNumber ?? 'report').replace(/[^A-Za-z0-9_-]/g, '_')}-v${report.version || 'draft'}.pdf`;
      return { path: report.pdfPath, filename, version: report.version };
    }
    return this.generateAndStore(reportId);
  }

  private async renderPdf(input: {
    report: ReportEntity;
    caseDoc: CaseEntity;
    patient: PatientEntity;
    lab: LabEntity;
    signer: UserEntity | null;
    specimens: SpecimenEntity[];
    blocks: BlockEntity[];
    content: ProtocolContent;
    qrBuffer: Buffer | null;
  }): Promise<Buffer> {
    const { report, caseDoc, patient, lab, signer, specimens, blocks, content, qrBuffer } = input;
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: 104, bottom: 76, left: MARGIN, right: MARGIN },
      info: {
        Title: `Histopathology report ${caseDoc.accessionNumber}`,
        Author: lab.name,
        Subject: content.title,
        CreationDate: new Date(),
      },
    });
    doc.registerFont('Body', this.fontRegular);
    doc.registerFont('Body-Bold', this.fontBold);
    doc.registerFont('Body-Italic', this.fontItalic);

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<void>((resolve, reject) => {
      doc.on('end', () => resolve());
      doc.on('error', (error) => reject(error));
    });

    this.drawLetterhead(doc, lab);
    doc.x = MARGIN;
    doc.on('pageAdded', () => {
      this.drawRunningHeader(doc, lab, caseDoc.accessionNumber);
    });

    const draft = report.status === 'DRAFT';
    const amended = report.status === 'AMENDED';

    doc.y = 112;
    doc
      .font('Body-Bold')
      .fontSize(8)
      .fillColor(ACCENT)
      .text('ANATOMICAL PATHOLOGY REPORT', { characterSpacing: 1.6 });
    doc.moveDown(0.25);
    doc
      .font('Body-Bold')
      .fontSize(19)
      .fillColor(INK)
      .text(content.title, { lineGap: 1, width: CONTENT_WIDTH });
    doc.moveDown(0.15);
    doc
      .font('Body')
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(
        `Accession ${caseDoc.accessionNumber}  ·  ${report.protocolSnapshot.title}  ·  Protocol v${report.protocolVersion}  ·  Report v${report.version}`,
        {
          characterSpacing: 0.3,
          width: CONTENT_WIDTH,
        },
      );

    if (draft || amended) {
      doc.moveDown(0.6);
      const bannerText = draft
        ? 'DRAFT — NOT VALID UNTIL ELECTRONICALLY SIGNED OUT'
        : 'AMENDED REPORT — SUPERSEDES THE PREVIOUS VERSION';
      const bannerY = doc.y;
      doc.rect(MARGIN, bannerY, CONTENT_WIDTH, 22).fill(draft ? '#F4E7DC' : '#F6E3DE');
      doc
        .font('Body-Bold')
        .fontSize(8)
        .fillColor(ACCENT)
        .text(bannerText, MARGIN + 8, bannerY + 7, { characterSpacing: 0.8 });
      doc.y = bannerY + 30;
    }

    doc.moveDown(0.7);
    this.drawMeta(doc, [
      ['Patient', `${patient.firstName} ${patient.lastName}`, 'Accession', caseDoc.accessionNumber],
      ['MRN', patient.mrn, 'Received', this.date(caseDoc.receivedAt)],
      [
        'Sex / age',
        `${this.sexLabel(patient.sex)} / ${patient.age ?? '—'}`,
        'Reported',
        report.signedOutAt ? this.date(report.signedOutAt) : 'Not signed',
      ],
      [
        'Priority',
        caseDoc.priority.replace('_', ' ').toLowerCase(),
        'Pathologist',
        signer?.name ?? lab.letterhead.pathologistName ?? '—',
      ],
      [
        'Referrer',
        caseDoc.referringClinician.name,
        'Facility',
        caseDoc.referringClinician.facility ?? '—',
      ],
    ]);

    doc.x = MARGIN;
    this.drawSectionTitle(doc, 'Clinical history');
    this.drawParagraph(doc, caseDoc.clinicalHistory);
    if (caseDoc.clinicalDiagnosis) {
      this.drawParagraph(doc, `Clinical diagnosis: ${caseDoc.clinicalDiagnosis}`);
    }

    this.drawSectionTitle(doc, 'Gross description');
    if (specimens.length === 0) {
      this.drawParagraph(doc, 'No specimen recorded.');
    }
    for (const specimen of specimens) {
      this.ensureSpace(doc, 34);
      doc
        .font('Body-Bold')
        .fontSize(9.5)
        .fillColor(INK)
        .text(`Specimen ${specimen.label} — ${specimen.specimenType}, ${specimen.site}`);
      const gross =
        specimen.grossDescription ?? specimen.description ?? 'No gross description recorded.';
      this.drawParagraph(doc, gross, 9);
      const specimenBlocks = blocks.filter(
        (block) => block.specimenId.toString() === specimen._id.toString(),
      );
      if (specimenBlocks.length > 0) {
        doc
          .font('Body')
          .fontSize(8.5)
          .fillColor(MUTED)
          .text(
            `Blocks: ${specimenBlocks
              .map(
                (block) =>
                  `${block.label}${block.slideCount > 0 ? ` (${block.slideCount} slides)` : ''}`,
              )
              .join(', ')}`,
            { lineGap: 1.5 },
          );
      }
    }

    const diagnosisFields = flattenProtocolFields(content).filter(
      (field) => /diagnosis/i.test(field.label) && field.type === 'textarea',
    );
    const diagnosisEntries = diagnosisFields
      .map((field) => {
        const value = report.data[field.key];
        return typeof value === 'string' && value.trim()
          ? { label: field.narrativeLabel ?? field.label, value: value.trim() }
          : null;
      })
      .filter((entry): entry is { label: string; value: string } => entry !== null);

    const diagnosisKeys = new Set(diagnosisFields.map((field) => field.key));
    const narrativeContent: ProtocolContent = {
      ...content,
      // The diagnosis gets a dedicated box, so remove its whole section from the
      // running narrative to avoid a duplicate heading and duplicated prose.
      sections: content.sections.filter(
        (section) => !section.fields.some((field) => diagnosisKeys.has(field.key)),
      ),
    };
    const narrative = generateNarrative(narrativeContent, report.data);
    const body = narrative.split('\n').filter((line) => line.trim().length > 0);
    const commentFields = flattenProtocolFields(content).filter(
      (field) =>
        /comment|note|recommend/i.test(field.label) &&
        typeof report.data[field.key] === 'string' &&
        String(report.data[field.key]).trim().length > 0,
    );

    this.drawSectionTitle(doc, 'Synoptic and microscopic findings');
    if (body.length === 0) {
      this.drawParagraph(doc, 'No structured findings recorded.');
    }
    for (const line of body) {
      if (line === content.title.toUpperCase()) continue;
      const isHeading = /^[A-Z][A-Z0-9 /&(),\-–—]{2,}$/.test(line) && line.length < 80;
      this.ensureSpace(doc, 18);
      if (isHeading) {
        doc.moveDown(0.35);
        doc.font('Body-Bold').fontSize(8).fillColor(ACCENT).text(line, { characterSpacing: 0.9 });
      } else {
        doc.font('Body').fontSize(9.3).fillColor(INK).text(line, { lineGap: 2.2 });
        doc.moveDown(0.12);
      }
    }

    if (diagnosisEntries.length > 0) {
      this.drawSectionTitle(doc, 'Final diagnosis');
      for (const entry of diagnosisEntries) {
        this.ensureSpace(doc, 50);
        const bodyText =
          entry.label.toLowerCase().includes('final diagnosis') || diagnosisEntries.length === 1
            ? entry.value
            : `${entry.label}: ${entry.value}`;
        const textHeight = doc
          .font('Body-Bold')
          .fontSize(10.2)
          .heightOfString(bodyText, { width: CONTENT_WIDTH - 24 });
        const boxHeight = textHeight + 18;
        const boxY = doc.y;
        doc.rect(MARGIN, boxY, CONTENT_WIDTH, boxHeight).fill(BONE);
        doc.rect(MARGIN, boxY, 3, boxHeight).fill(ACCENT);
        doc
          .fillColor(INK)
          .font('Body-Bold')
          .fontSize(10.2)
          .text(bodyText, MARGIN + 12, boxY + 9, {
            width: CONTENT_WIDTH - 24,
            lineGap: 2,
          });
        doc.x = MARGIN;
        doc.y = boxY + boxHeight + 8;
      }
      for (const field of commentFields) {
        const value = report.data[field.key];
        if (typeof value !== 'string') continue;
        this.drawParagraph(doc, `${field.label}: ${value.trim()}`);
      }
    }

    this.ensureSpace(doc, 170);
    this.drawSectionTitle(doc, 'Authorization');
    const signatureY = doc.y + 8;
    doc
      .moveTo(MARGIN, signatureY)
      .lineTo(MARGIN + 250, signatureY)
      .strokeColor(LINE)
      .stroke();
    doc
      .font('Body-Bold')
      .fontSize(10)
      .fillColor(INK)
      .text(
        signer?.name ?? lab.letterhead.pathologistName ?? 'Pathologist',
        MARGIN,
        signatureY + 7,
        {
          width: 250,
        },
      );
    if (lab.letterhead.qualifications) {
      doc
        .font('Body')
        .fontSize(8.2)
        .fillColor(MUTED)
        .text(lab.letterhead.qualifications, { width: 250 });
    }
    doc
      .font('Body')
      .fontSize(8.2)
      .fillColor(MUTED)
      .text(
        signer
          ? `Consultant pathologist${signer.subspecialties.length > 0 ? ` · ${signer.subspecialties.join(', ')}` : ''}`
          : 'Consultant pathologist',
        { width: 250 },
      );
    doc.moveDown(0.35);
    if (report.signedOutAt) {
      doc
        .font('Body-Italic')
        .fontSize(8.2)
        .fillColor(MUTED)
        .text(
          `Electronically signed by ${signer?.name ?? 'pathologist'} on ${this.dateTime(report.signedOutAt)}`,
          { width: 250, lineGap: 1 },
        );
    } else {
      doc
        .font('Body-Bold')
        .fontSize(8.2)
        .fillColor(ACCENT)
        .text('UNSIGNED DRAFT — clinical action must not be taken on this document.', {
          width: 250,
          lineGap: 1,
        });
    }

    if (qrBuffer && report.verificationCode) {
      const qrX = MARGIN + CONTENT_WIDTH - 96;
      const qrY = signatureY - 6;
      doc.image(qrBuffer, qrX, qrY, { width: 82, height: 82 });
      doc
        .font('Body')
        .fontSize(6.8)
        .fillColor(MUTED)
        .text('Scan to verify', qrX, qrY + 86, { width: 96, align: 'center' });
      doc
        .font('Body-Bold')
        .fontSize(7)
        .fillColor(INK)
        .text(report.verificationCode, qrX, qrY + 96, { width: 96, align: 'center' });
    }

    if (amended && report.amendmentReason) {
      this.drawSectionTitle(doc, 'Reason for amendment');
      this.drawParagraph(doc, report.amendmentReason);
    }

    const pageRange = doc.bufferedPageRange();
    const total = pageRange.count;
    for (let index = 0; index < total; index += 1) {
      doc.switchToPage(index);
      // Stamping happens outside the content area. Without removing the bottom
      // margin PDFKit treats footer text as overflow and silently adds pages.
      const originalBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      if (draft) {
        doc.save();
        doc.opacity(0.06);
        doc
          .font('Body-Bold')
          .fontSize(58)
          .fillColor(ACCENT)
          .rotate(-32, { origin: [PAGE_WIDTH / 2, PAGE_HEIGHT / 2] })
          .text('DRAFT', 0, PAGE_HEIGHT / 2 - 40, { width: PAGE_WIDTH, align: 'center' });
        doc.restore();
      }
      this.drawFooter(doc, lab, caseDoc.accessionNumber, index + 1, total, report.verificationCode);
      doc.page.margins.bottom = originalBottom;
    }
    doc.flushPages();
    doc.end();
    await finished;
    return Buffer.concat(chunks);
  }

  private drawLetterhead(doc: PDFKit.PDFDocument, lab: LabEntity): void {
    doc.rect(0, 0, PAGE_WIDTH, 4).fill(ACCENT);
    const initials = lab.name
      .replace(/[^A-Za-z ]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
    doc.rect(MARGIN, 42, 34, 34).fill(INK);
    doc
      .font('Body-Bold')
      .fontSize(14)
      .fillColor('#FFFFFF')
      .text(initials || 'HP', MARGIN, 51, { width: 34, align: 'center' });

    doc
      .font('Body-Bold')
      .fontSize(14.5)
      .fillColor(INK)
      .text(lab.name, MARGIN + 44, 42, { width: CONTENT_WIDTH - 150, lineGap: 1 });
    doc
      .font('Body')
      .fontSize(7.8)
      .fillColor(MUTED)
      .text(
        [lab.address, [lab.phone, lab.letterhead.email ?? lab.email].filter(Boolean).join(' · ')]
          .filter(Boolean)
          .join('\n') || 'Histopathology laboratory',
        MARGIN + 44,
        62,
        { width: CONTENT_WIDTH - 150, lineGap: 1.5 },
      );

    doc
      .font('Body-Bold')
      .fontSize(7)
      .fillColor(ACCENT)
      .text('HISTOPATHOLOGY', MARGIN + CONTENT_WIDTH - 100, 44, {
        width: 100,
        align: 'right',
        characterSpacing: 1.4,
      });
    doc
      .font('Body')
      .fontSize(7)
      .fillColor(MUTED)
      .text('CONFIDENTIAL CLINICAL RECORD', MARGIN + CONTENT_WIDTH - 150, 55, {
        width: 150,
        align: 'right',
        characterSpacing: 0.5,
      });
    doc
      .moveTo(MARGIN, 92)
      .lineTo(MARGIN + CONTENT_WIDTH, 92)
      .strokeColor(LINE)
      .lineWidth(0.8)
      .stroke();
  }

  private drawRunningHeader(doc: PDFKit.PDFDocument, lab: LabEntity, accession: string): void {
    doc.rect(0, 0, PAGE_WIDTH, 3).fill(ACCENT);
    doc
      .font('Body-Bold')
      .fontSize(7.5)
      .fillColor(INK)
      .text(lab.name, MARGIN, 30, { width: CONTENT_WIDTH - 130 });
    doc
      .font('Body')
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(`Accession ${accession}`, MARGIN + CONTENT_WIDTH - 130, 30, {
        width: 130,
        align: 'right',
      });
    doc
      .moveTo(MARGIN, 44)
      .lineTo(MARGIN + CONTENT_WIDTH, 44)
      .strokeColor(LINE)
      .lineWidth(0.7)
      .stroke();
    doc.y = 104;
    doc.x = MARGIN;
  }

  private drawMeta(doc: PDFKit.PDFDocument, rows: [string, string, string, string][]): void {
    const rowHeight = 27;
    const columnWidth = CONTENT_WIDTH / 2 - 10;
    for (const [leftLabel, leftValue, rightLabel, rightValue] of rows) {
      this.ensureSpace(doc, rowHeight + 4);
      const y = doc.y;
      doc
        .font('Body-Bold')
        .fontSize(6.5)
        .fillColor(MUTED)
        .text(leftLabel.toUpperCase(), MARGIN, y, { characterSpacing: 0.8, width: columnWidth });
      doc
        .font('Body')
        .fontSize(9)
        .fillColor(INK)
        .text(leftValue || '—', MARGIN, y + 9, { width: columnWidth });
      doc
        .font('Body-Bold')
        .fontSize(6.5)
        .fillColor(MUTED)
        .text(rightLabel.toUpperCase(), MARGIN + CONTENT_WIDTH / 2 + 8, y, {
          characterSpacing: 0.8,
          width: columnWidth,
        });
      doc
        .font('Body')
        .fontSize(9)
        .fillColor(INK)
        .text(rightValue || '—', MARGIN + CONTENT_WIDTH / 2 + 8, y + 9, { width: columnWidth });
      doc.y = y + rowHeight;
    }
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + CONTENT_WIDTH, doc.y)
      .strokeColor(LINE)
      .lineWidth(0.7)
      .stroke();
    doc.moveDown(0.4);
    doc.x = MARGIN;
  }

  private drawSectionTitle(doc: PDFKit.PDFDocument, title: string): void {
    this.ensureSpace(doc, 36);
    doc.x = MARGIN;
    doc.moveDown(0.55);
    doc
      .font('Body-Bold')
      .fontSize(7.5)
      .fillColor(ACCENT)
      .text(title.toUpperCase(), { characterSpacing: 1.3, width: CONTENT_WIDTH });
    doc.moveDown(0.18);
    doc
      .moveTo(MARGIN, doc.y)
      .lineTo(MARGIN + 40, doc.y)
      .strokeColor(ACCENT)
      .lineWidth(1.2)
      .stroke();
    doc.moveDown(0.35);
  }

  private drawParagraph(doc: PDFKit.PDFDocument, text: string, size = 9.3): void {
    const safe = text.trim();
    if (!safe) return;
    doc.x = MARGIN;
    doc
      .font('Body')
      .fontSize(size)
      .fillColor(INK)
      .text(safe, { lineGap: 2.2, width: CONTENT_WIDTH });
    doc.moveDown(0.3);
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
    if (doc.y + needed > PAGE_HEIGHT - 80) {
      doc.addPage();
    }
  }

  private drawFooter(
    doc: PDFKit.PDFDocument,
    lab: LabEntity,
    accession: string,
    page: number,
    total: number,
    verificationCode: string | null,
  ): void {
    const footerY = PAGE_HEIGHT - 46;
    doc
      .moveTo(MARGIN, footerY - 8)
      .lineTo(MARGIN + CONTENT_WIDTH, footerY - 8)
      .strokeColor(LINE)
      .lineWidth(0.6)
      .stroke();
    const note =
      lab.letterhead.footerNote ??
      `${lab.name} · This report is confidential and intended for the named patient and referrer.`;
    doc
      .font('Body')
      .fontSize(6.7)
      .fillColor(MUTED)
      .text(note, MARGIN, footerY, {
        width: CONTENT_WIDTH - 130,
        lineGap: 1,
      });
    doc
      .font('Body')
      .fontSize(6.7)
      .fillColor(MUTED)
      .text(
        `${accession}${verificationCode ? ` · Verify ${verificationCode}` : ''} · Page ${page} of ${total}`,
        MARGIN + CONTENT_WIDTH - 180,
        footerY,
        { width: 180, align: 'right' },
      );
  }

  private date(value: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(value);
  }

  private dateTime(value: Date): string {
    return `${this.date(value)} at ${new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false,
    }).format(value)} UTC`;
  }

  private sexLabel(sex: string): string {
    const map: Record<string, string> = {
      FEMALE: 'Female',
      MALE: 'Male',
      OTHER: 'Other',
      UNKNOWN: 'Unknown',
    };
    return map[sex] ?? sex;
  }
}
