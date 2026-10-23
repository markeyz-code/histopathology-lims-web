import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { CaseStatus, ReportStatus } from '@lims/shared';
import { CaseModelName, type CaseEntity } from '../cases/case.schema';
import { LabModelName, type LabEntity } from '../labs/lab.schema';
import { PatientModelName, type PatientEntity } from '../patients/patient.schema';
import { ReportModelName, type ReportEntity } from '../reports/report.schema';
import { SpecimenModelName, type SpecimenEntity } from '../specimens/specimen.schema';
import type { FhirSearchDto } from './dto/fhir.dto';

@Injectable()
export class FhirService {
  constructor(
    @InjectModel(PatientModelName) private readonly patientModel: Model<PatientEntity>,
    @InjectModel(CaseModelName) private readonly caseModel: Model<CaseEntity>,
    @InjectModel(SpecimenModelName) private readonly specimenModel: Model<SpecimenEntity>,
    @InjectModel(ReportModelName) private readonly reportModel: Model<ReportEntity>,
    @InjectModel(LabModelName) private readonly labModel: Model<LabEntity>,
    private readonly config: ConfigService,
  ) {}

  capabilityStatement() {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      software: { name: 'Histopathology LIMS', version: '1.2.0' },
      implementation: { description: 'Histopathology laboratory interoperability API' },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [
        {
          mode: 'server',
          resource: ['Patient', 'ServiceRequest', 'Specimen', 'DiagnosticReport'].map((type) => ({
            type,
            interaction: [{ code: 'read' }, { code: 'search-type' }],
          })),
        },
      ],
    };
  }

  async patient(id: string) {
    const patient = await this.patientModel.findById(id).exec();
    if (!patient) throw new NotFoundException('Patient not found.');
    return this.patientResource(patient);
  }

  async searchPatients(query: FhirSearchDto) {
    const filter: Record<string, unknown> = {};
    if (query._id) filter._id = new Types.ObjectId(query._id);
    if (query.identifier) {
      filter.mrn = query.identifier.trim().toUpperCase();
    }
    const docs = await this.patientModel
      .find(filter)
      .limit(query._count ?? 20)
      .exec();
    return this.bundle(docs.map((doc) => this.patientResource(doc)));
  }

  async serviceRequest(id: string) {
    const caseDoc = await this.caseModel.findById(id).exec();
    if (!caseDoc) throw new NotFoundException('ServiceRequest not found.');
    return this.serviceRequestResource(caseDoc);
  }

  async searchServiceRequests(query: FhirSearchDto) {
    const filter: Record<string, unknown> = {};
    if (query._id) filter._id = new Types.ObjectId(query._id);
    if (query.identifier) filter.accessionNumber = query.identifier.trim().toUpperCase();
    if (query.subject) {
      const patientId = this.stripType(query.subject, 'Patient');
      if (!Types.ObjectId.isValid(patientId)) throw new BadRequestException('Invalid subject.');
      filter.patientId = new Types.ObjectId(patientId);
    }
    if (query.date) {
      filter.receivedAt = {
        $gte: new Date(`${query.date}T00:00:00.000Z`),
        $lte: new Date(`${query.date}T23:59:59.999Z`),
      };
    }
    const docs = await this.caseModel
      .find(filter)
      .sort({ receivedAt: -1 })
      .limit(query._count ?? 20)
      .exec();
    return this.bundle(docs.map((doc) => this.serviceRequestResource(doc)));
  }

  async specimen(id: string) {
    const specimen = await this.specimenModel.findById(id).exec();
    if (!specimen) throw new NotFoundException('Specimen not found.');
    return this.specimenResource(specimen);
  }

  async searchSpecimens(query: FhirSearchDto) {
    const filter: Record<string, unknown> = {};
    if (query._id) filter._id = new Types.ObjectId(query._id);
    if (query.identifier) filter.barcode = query.identifier.trim().toUpperCase();
    if (query.subject) {
      const patientId = this.stripType(query.subject, 'Patient');
      if (!Types.ObjectId.isValid(patientId)) throw new BadRequestException('Invalid subject.');
      const cases = await this.caseModel
        .find({ patientId: new Types.ObjectId(patientId) })
        .select('_id')
        .exec();
      filter.caseId = { $in: cases.map((item) => item._id) };
    }
    const docs = await this.specimenModel
      .find(filter)
      .limit(query._count ?? 20)
      .exec();
    return this.bundle(await Promise.all(docs.map((doc) => this.specimenResource(doc))));
  }

  async diagnosticReport(id: string) {
    const report = await this.reportModel.findById(id).exec();
    if (!report) throw new NotFoundException('DiagnosticReport not found.');
    return this.diagnosticReportResource(report);
  }

  async searchDiagnosticReports(query: FhirSearchDto) {
    const filter: Record<string, unknown> = {};
    if (query._id) filter._id = new Types.ObjectId(query._id);
    if (query.identifier) filter.verificationCode = query.identifier.trim().toUpperCase();
    if (query.subject) {
      const patientId = this.stripType(query.subject, 'Patient');
      if (!Types.ObjectId.isValid(patientId)) throw new BadRequestException('Invalid subject.');
      const cases = await this.caseModel
        .find({ patientId: new Types.ObjectId(patientId) })
        .select('_id')
        .exec();
      filter.caseId = { $in: cases.map((item) => item._id) };
    }
    if (query.status === 'final') {
      filter.status = { $in: ['SIGNED_OUT', 'AMENDED'] };
    } else if (query.status === 'preliminary') {
      filter.status = 'DRAFT';
    }
    if (query.date) {
      filter.signedOutAt = {
        $gte: new Date(`${query.date}T00:00:00.000Z`),
        $lte: new Date(`${query.date}T23:59:59.999Z`),
      };
    }
    const docs = await this.reportModel
      .find(filter)
      .sort({ signedOutAt: -1 })
      .limit(query._count ?? 20)
      .exec();
    return this.bundle(await Promise.all(docs.map((doc) => this.diagnosticReportResource(doc))));
  }

  private async patientResource(patient: PatientEntity) {
    return {
      resourceType: 'Patient',
      id: patient._id.toString(),
      identifier: [
        {
          use: 'usual',
          type: { text: 'Medical record number' },
          system: 'urn:lims:mrn',
          value: patient.mrn,
        },
      ],
      active: true,
      name: [{ use: 'official', family: patient.lastName, given: [patient.firstName] }],
      telecom: patient.phone ? [{ system: 'phone', value: patient.phone }] : [],
      gender: this.gender(patient.sex),
      birthDate: patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : undefined,
      address: patient.address ? [{ text: patient.address, country: 'NG' }] : [],
    };
  }

  private serviceRequestResource(caseDoc: CaseEntity) {
    const lab = caseDoc.labId.toString();
    return {
      resourceType: 'ServiceRequest',
      id: caseDoc._id.toString(),
      identifier: [{ system: 'urn:lims:accession', value: caseDoc.accessionNumber }],
      status: this.serviceStatus(caseDoc.status),
      intent: 'order',
      priority: caseDoc.priority === 'FROZEN' ? 'stat' : caseDoc.priority.toLowerCase(),
      code: { text: 'Histopathology examination', coding: [] },
      subject: { reference: `Patient/${caseDoc.patientId.toString()}` },
      authoredOn: caseDoc.receivedAt.toISOString(),
      requester: {
        display: caseDoc.referringClinician.name,
        ...(caseDoc.referringClinician.facility
          ? { reference: `Organization/${caseDoc.referringClinician.facility}` }
          : {}),
      },
      performer: [{ reference: `Organization/${lab}`, display: 'Histopathology laboratory' }],
      reasonCode: caseDoc.clinicalDiagnosis ? [{ text: caseDoc.clinicalDiagnosis }] : [],
      note: [{ text: caseDoc.clinicalHistory }],
    };
  }

  private async specimenResource(specimen: SpecimenEntity) {
    const caseDoc = await this.caseModel.findById(specimen.caseId).select('patientId').exec();
    return {
      resourceType: 'Specimen',
      id: specimen._id.toString(),
      identifier: [
        { system: 'urn:lims:barcode', value: specimen.barcode },
        { system: 'urn:lims:specimen-label', value: specimen.label },
      ],
      status: specimen.status === 'REJECTED' ? 'unavailable' : 'available',
      type: { text: specimen.specimenType },
      subject: {
        reference: `Patient/${caseDoc?.patientId.toString() ?? specimen.caseId.toString()}`,
      },
      receivedTime: specimen.receivedAt.toISOString(),
      collection: {
        collectedDateTime: specimen.collectedAt ? specimen.collectedAt.toISOString() : undefined,
        bodySite: { text: specimen.site },
      },
      note: specimen.grossDescription ? [{ text: specimen.grossDescription }] : [],
    };
  }

  private async diagnosticReportResource(report: ReportEntity) {
    const [caseDoc, patient] = await Promise.all([
      this.caseModel.findById(report.caseId).exec(),
      this.caseModel
        .findById(report.caseId)
        .exec()
        .then((item) => (item ? this.patientModel.findById(item.patientId).exec() : null)),
    ]);
    if (!caseDoc) throw new NotFoundException('Case not found for report.');
    const coding = report.coding;
    const conclusions = coding?.snomedCode
      ? [
          {
            system: 'http://snomed.info/sct',
            code: coding.snomedCode,
            display: coding.snomedDisplay ?? undefined,
          },
        ]
      : [];
    return {
      resourceType: 'DiagnosticReport',
      id: report._id.toString(),
      identifier: [
        { system: 'urn:lims:accession', value: caseDoc.accessionNumber },
        ...(report.verificationCode
          ? [{ system: 'urn:lims:verification', value: report.verificationCode }]
          : []),
      ],
      status: this.reportStatus(report.status),
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'PAT',
              display: 'Pathology',
            },
          ],
          text: 'Pathology',
        },
      ],
      code: {
        text: report.protocolSnapshot.cancerType,
        coding: coding?.snomedCode
          ? [
              {
                system: 'http://snomed.info/sct',
                code: coding.snomedCode,
                display: coding.snomedDisplay ?? undefined,
              },
            ]
          : [],
      },
      subject: {
        reference: `Patient/${caseDoc.patientId.toString()}`,
        display: patient ? `${patient.firstName} ${patient.lastName}` : undefined,
      },
      effectiveDateTime: (report.signedOutAt ?? report.updatedAt).toISOString(),
      issued: report.signedOutAt ? report.signedOutAt.toISOString() : undefined,
      performer: [
        {
          reference: `Organization/${caseDoc.labId.toString()}`,
          display: 'Histopathology laboratory',
        },
      ],
      resultsInterpreter: report.signedOutBy
        ? [{ reference: `Practitioner/${report.signedOutBy.toString()}` }]
        : [],
      conclusion: this.diagnosisText(report),
      conclusionCode: conclusions,
      presentedForm: [
        {
          contentType: 'application/pdf',
          url: `${this.config.get<string>('PUBLIC_API_URL') ?? ''}/reports/${report._id.toString()}/pdf`,
          title: `Report ${caseDoc.accessionNumber}`,
        },
      ],
      extension: [
        {
          url: 'urn:lims:icdo3-morphology',
          valueCodeableConcept: coding?.icdo3MorphologyCode
            ? {
                coding: [
                  {
                    system: 'urn:oid:2.16.840.1.113883.6.43.1',
                    code: coding.icdo3MorphologyCode,
                    display: coding.icdo3MorphologyDisplay ?? undefined,
                  },
                ],
              }
            : undefined,
        },
        {
          url: 'urn:lims:icdo3-topography',
          valueCodeableConcept: coding?.icdo3TopographyCode
            ? {
                coding: [
                  {
                    system: 'urn:oid:2.16.840.1.113883.6.43.1',
                    code: coding.icdo3TopographyCode,
                    display: coding.icdo3TopographyDisplay ?? undefined,
                  },
                ],
              }
            : undefined,
        },
      ],
    };
  }

  private bundle(entries: unknown[]) {
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries.map((resource) => ({ resource, search: { mode: 'match' } })),
    };
  }

  private stripType(value: string, type: string): string {
    return value.startsWith(`${type}/`) ? value.slice(type.length + 1) : value;
  }

  private diagnosisText(report: ReportEntity): string {
    for (const key of ['finalDiagnosis', 'diagnosis']) {
      const value = report.data[key];
      if (typeof value === 'string' && value.trim()) return value;
    }
    return report.narrative.slice(0, 1_000);
  }

  private gender(sex: string): string {
    if (sex === 'MALE') return 'male';
    if (sex === 'FEMALE') return 'female';
    if (sex === 'OTHER') return 'other';
    return 'unknown';
  }

  private serviceStatus(status: CaseStatus): string {
    if (status === 'REPORTED' || status === 'AMENDED') return 'completed';
    return 'active';
  }

  private reportStatus(status: ReportStatus): string {
    if (status === 'AMENDED') return 'corrected';
    if (status === 'SIGNED_OUT') return 'final';
    return 'preliminary';
  }
}
