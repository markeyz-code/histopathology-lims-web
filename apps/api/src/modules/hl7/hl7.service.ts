import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { runWithTenant } from '../../common/context/tenant-context';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { CasesService } from '../cases/cases.service';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { ReportModelName, type ReportEntity } from '../reports/report.schema';
import { UserModelName, type UserEntity } from '../users/user.schema';
import { parseHl7Order, wrapMllp } from './hl7.parser';

export interface Hl7IngestResult {
  ack: string;
  caseId?: string;
  accessionNumber?: string;
  error?: string;
}

@Injectable()
export class Hl7Service {
  private readonly logger = new Logger(Hl7Service.name);

  constructor(
    private readonly config: ConfigService,
    private readonly cases: CasesService,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(ReportModelName) private readonly reportModel: Model<ReportEntity>,
  ) {}

  async ingest(raw: string): Promise<Hl7IngestResult> {
    let parsed;
    try {
      parsed = parseHl7Order(raw);
    } catch (error) {
      return this.errorAck('', error instanceof Error ? error.message : 'Invalid HL7 message.');
    }
    const labCode = this.config.get<string>('HL7_LAB_CODE') ?? 'HISTO';
    const lab = await this.labModel.findOne({ code: labCode.toUpperCase(), active: true }).exec();
    if (!lab) return this.errorAck(parsed.controlId, 'HL7 laboratory is not configured.');

    return runWithTenant({ labId: lab._id.toString() }, async () => {
      const user = await this.userModel
        .findOne({ role: { $in: ['LAB_ADMIN', 'SUPER_ADMIN'] }, active: true })
        .sort({ role: 1 })
        .exec();
      if (!user) return this.errorAck(parsed.controlId, 'No integration user is configured.');

      const actor: AuthenticatedUser = {
        id: user._id.toString(),
        labId: lab._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        subspecialties: user.subspecialties,
      };
      try {
        const result = await this.cases.accession(
          {
            patient: {
              mrn: parsed.patient.mrn,
              firstName: parsed.patient.firstName,
              lastName: parsed.patient.lastName,
              sex: parsed.patient.sex,
              dateOfBirth: parsed.patient.dateOfBirth,
              age: parsed.patient.age,
              phone: parsed.patient.phone,
              address: parsed.patient.address,
            },
            referringClinician: {
              name: parsed.referringClinician.name,
              facility: parsed.referringClinician.facility,
              phone: parsed.referringClinician.phone,
            },
            clinicalHistory: parsed.clinicalHistory,
            clinicalDiagnosis: parsed.clinicalDiagnosis,
            priority: parsed.priority,
            subspecialty: undefined,
            specimens: [
              {
                specimenType: parsed.specimenType,
                site: parsed.site,
              },
            ],
          },
          actor,
        );
        return {
          ack: this.ack(parsed.controlId, true, result.accessionNumber),
          caseId: result.id,
          accessionNumber: result.accessionNumber,
        };
      } catch (error) {
        this.logger.warn({ err: error, controlId: parsed.controlId }, 'HL7 order rejected.');
        return this.errorAck(
          parsed.controlId,
          error instanceof Error ? error.message : 'Order could not be accessioned.',
        );
      }
    });
  }

  async buildOru(caseId: string): Promise<string> {
    const caseDoc = await this.caseModel.findById(caseId).exec();
    if (!caseDoc) throw new NotFoundException('Case not found.');
    const [patient, report, lab] = await Promise.all([
      this.patientModel.findById(caseDoc.patientId).exec(),
      this.reportModel.findOne({ caseId: caseDoc._id }).exec(),
      this.labModel.findById(caseDoc.labId).exec(),
    ]);
    if (!patient) throw new NotFoundException('Patient not found.');
    if (!report || report.status === 'DRAFT') {
      throw new BadGatewayException('Only a signed report can produce an ORU message.');
    }
    const now = new Date();
    const stamp = now
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const diagnosis = this.diagnosisText(report);
    const segments = [
      `MSH|^~\\&|HISTOLIMS|${escapeHl7(lab?.name ?? 'LAB')}|EMR|HOSPITAL|${stamp}||ORU^R01|${report._id.toString()}|P|2.5`,
      `PID|1||${escapeHl7(patient.mrn)}||${escapeHl7(patient.lastName)}^${escapeHl7(patient.firstName)}||${patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10).replace(/-/g, '') : ''}|${patient.sex.charAt(0)}`,
      `OBR|1||${escapeHl7(caseDoc.accessionNumber)}|${escapeHl7(report.protocolSnapshot.cancerType)}^${escapeHl7(report.protocolSnapshot.key)}^L|||${(report.signedOutAt ?? now).toISOString()}|${(report.signedOutAt ?? now).toISOString()}|||${escapeHl7(caseDoc.referringClinician.name)}||||||||F`,
      `OBX|1|TX|${escapeHl7(report.verificationCode ?? 'REPORT')}||${escapeHl7(diagnosis)}||||||F`,
      `OBX|2|TX|NARRATIVE||${escapeHl7(report.narrative)}||||||F`,
    ];
    return segments.join('\r') + '\r';
  }

  ackFrame(ack: string): string {
    return wrapMllp(ack);
  }

  private ack(controlId: string, ok: boolean, message: string): string {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    return [
      `MSH|^~\\&|HISTOLIMS|LAB|EMR|HOSPITAL|${stamp}||ACK^O01|ACK-${controlId}|P|2.5`,
      `MSA|${ok ? 'AA' : 'AE'}|${escapeHl7(controlId)}|${escapeHl7(message)}`,
    ].join('\r');
  }

  private errorAck(controlId: string, message: string): Hl7IngestResult {
    return { ack: this.ack(controlId, false, message), error: message };
  }

  private diagnosisText(report: ReportEntity): string {
    for (const key of ['finalDiagnosis', 'diagnosis']) {
      const value = report.data[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return report.narrative.slice(0, 1_000);
  }
}

function escapeHl7(value: string): string {
  return value
    .replaceAll('\\', '\\E\\')
    .replaceAll('|', '\\F\\')
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ');
}
