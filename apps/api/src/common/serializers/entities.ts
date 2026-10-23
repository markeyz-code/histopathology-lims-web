import {
  specimenLetter,
  type AuditLog as AuditLogDto,
  type Block as BlockDto,
  type CaseListItem,
  type CustodyEvent as CustodyEventDto,
  type Lab as LabDto,
  type Patient as PatientDto,
  type PatientSummary,
  type Protocol,
  type ProtocolContent,
  type ReportCoding,
  type ReportDetail,
  type ReportSummary,
  type ReportVersion as ReportVersionDto,
  type Slide as SlideDto,
  type Specimen as SpecimenDto,
  type WsiInfo,
  type User as UserDto,
  type UserSummary,
} from '@lims/shared';
import type { AuditLogEntity } from '../../modules/audit/audit-log.schema';
import type { BlockEntity } from '../../modules/blocks/block.schema';
import type { CaseEntity } from '../../modules/cases/case.schema';
import type { CustodyEventEntity } from '../../modules/custody/custody-event.schema';
import type { LabEntity } from '../../modules/labs/lab.schema';
import type { PatientEntity } from '../../modules/patients/patient.schema';
import type { ProtocolEntity } from '../../modules/protocols/protocol.schema';
import type { ReportVersionEntity } from '../../modules/reports/report-version.schema';
import type { ReportEntity } from '../../modules/reports/report.schema';
import type { SlideEntity } from '../../modules/slides/slide.schema';
import type { SpecimenEntity } from '../../modules/specimens/specimen.schema';
import type { UserEntity } from '../../modules/users/user.schema';
import { toIso } from '../utils/format';

export function toUserSummary(user: UserEntity): UserSummary {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    subspecialties: [...user.subspecialties],
  };
}

export function toUser(user: UserEntity): UserDto {
  return {
    ...toUserSummary(user),
    phone: user.phone ?? null,
    active: user.active,
    lastLoginAt: toIso(user.lastLoginAt),
    createdAt: toIso(user.createdAt) ?? new Date().toISOString(),
  };
}

export function toLab(lab: LabEntity): LabDto {
  return {
    id: lab._id.toString(),
    code: lab.code,
    name: lab.name,
    address: lab.address,
    phone: lab.phone,
    email: lab.email,
    accessionPrefix: lab.accessionPrefix,
    accessionFormat: lab.accessionFormat,
    tatHours: {
      FROZEN: lab.tatHours?.FROZEN ?? 1,
      URGENT: lab.tatHours?.URGENT ?? 24,
      ROUTINE: lab.tatHours?.ROUTINE ?? 72,
    },
    tatWarningPercent: lab.tatWarningPercent ?? 80,
    timezone: lab.timezone ?? 'Africa/Lagos',
    qaSamplingPercent: lab.qaSamplingPercent ?? 10,
    currency: lab.currency ?? 'NGN',
    letterhead: {
      phone: lab.letterhead?.phone ?? null,
      email: lab.letterhead?.email ?? null,
      website: lab.letterhead?.website ?? null,
      pathologistName: lab.letterhead?.pathologistName ?? null,
      pathologistTitle: lab.letterhead?.pathologistTitle ?? null,
      qualifications: lab.letterhead?.qualifications ?? null,
      signatureText: lab.letterhead?.signatureText ?? null,
      footerNote: lab.letterhead?.footerNote ?? null,
    },
    active: lab.active,
    createdAt: toIso(lab.createdAt) ?? new Date().toISOString(),
  };
}

function dateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toPatientSummary(patient: PatientEntity): PatientSummary {
  return {
    id: patient._id.toString(),
    mrn: patient.mrn,
    firstName: patient.firstName,
    lastName: patient.lastName,
    sex: patient.sex,
    dateOfBirth: dateOnly(patient.dateOfBirth),
    age: patient.age,
  };
}

export function toPatient(patient: PatientEntity): PatientDto {
  return {
    ...toPatientSummary(patient),
    phone: patient.phone,
    email: patient.email,
    address: patient.address,
    nationalId: patient.nationalId,
    nextOfKin: patient.nextOfKin
      ? {
          name: patient.nextOfKin.name,
          phone: patient.nextOfKin.phone,
          relationship: patient.nextOfKin.relationship,
        }
      : null,
    createdAt: toIso(patient.createdAt) ?? new Date().toISOString(),
  };
}

export function toSpecimen(specimen: SpecimenEntity): SpecimenDto {
  return {
    id: specimen._id.toString(),
    caseId: specimen.caseId.toString(),
    sequence: specimen.sequence,
    label: specimen.label,
    barcode: specimen.barcode,
    specimenType: specimen.specimenType,
    site: specimen.site,
    laterality: specimen.laterality,
    description: specimen.description,
    collectedAt: toIso(specimen.collectedAt),
    receivedAt: toIso(specimen.receivedAt) ?? new Date().toISOString(),
    grossDescription: specimen.grossDescription,
    status: specimen.status,
    currentStation: specimen.currentStation,
    rejectionReason: specimen.rejectionReason,
    rejectionCode: (specimen.rejectionCode as SpecimenDto['rejectionCode']) ?? null,
    createdAt: toIso(specimen.createdAt) ?? new Date().toISOString(),
  };
}

export function toBlock(block: BlockEntity): BlockDto {
  return {
    id: block._id.toString(),
    caseId: block.caseId.toString(),
    specimenId: block.specimenId.toString(),
    specimenLabel: specimenLetter(block.specimenSequence),
    blockNumber: block.blockNumber,
    label: block.label,
    barcode: block.barcode,
    grossDescription: block.grossDescription,
    status: block.status,
    currentStation: block.currentStation,
    slideCount: block.slideCount,
    lastEventAt: toIso(block.lastEventAt),
    createdAt: toIso(block.createdAt) ?? new Date().toISOString(),
  };
}

export { toSlide as ToSlide };

export function toSlide(slide: SlideEntity): SlideDto {
  return {
    id: slide._id.toString(),
    caseId: slide.caseId.toString(),
    specimenId: slide.specimenId.toString(),
    blockId: slide.blockId.toString(),
    blockLabel: slide.blockLabel,
    slideNumber: slide.slideNumber,
    label: slide.label,
    barcode: slide.barcode,
    stainType: slide.stainType,
    specialStain: slide.specialStain,
    status: slide.status,
    currentStation: slide.currentStation,
    recutOfSlideId: slide.recutOfSlideId ? slide.recutOfSlideId.toString() : null,
    requestReason: slide.requestReason,
    notes: slide.notes,
    stainRunId: slide.stainRunId ? slide.stainRunId.toString() : null,
    wsi: toWsiInfo(slide),
    lastEventAt: toIso(slide.lastEventAt),
    createdAt: toIso(slide.createdAt) ?? new Date().toISOString(),
  };
}

export function toWsiInfo(slide: SlideEntity): WsiInfo | null {
  if (!slide.wsiStatus) return null;
  return {
    status: slide.wsiStatus as WsiInfo['status'],
    url: slide.wsiUrl ?? null,
    viewerUrl: slide.wsiViewerUrl ?? null,
    scanner: slide.wsiScanner ?? null,
    magnification: slide.wsiMagnification ?? null,
    addedAt: toIso(slide.wsiAddedAt),
    addedBy: slide.wsiAddedBy ? slide.wsiAddedBy.toString() : null,
    metadata: (slide.wsiMetadata ?? {}) as Record<string, unknown>,
  };
}

export function toCustodyEvent(event: CustodyEventEntity): CustodyEventDto {
  return {
    id: event._id.toString(),
    entityType: event.entityType,
    entityId: event.entityId.toString(),
    caseId: event.caseId ? event.caseId.toString() : null,
    eventType: event.eventType,
    station: event.station,
    fromState: event.fromState,
    toState: event.toState,
    reason: event.reason,
    userId: event.userId.toString(),
    userName: event.userName,
    userRole: event.userRole ?? 'TECHNOLOGIST',
    timestamp: toIso(event.timestamp) ?? new Date().toISOString(),
    metadata: (event.metadata ?? {}) as Record<string, unknown>,
  };
}

export function toProtocol(protocol: ProtocolEntity): Protocol {
  return {
    id: protocol._id.toString(),
    key: protocol.key,
    title: protocol.title,
    cancerType: protocol.cancerType,
    subspecialty: protocol.subspecialty,
    version: protocol.version,
    active: protocol.active,
    content: protocol.content,
    createdAt: toIso(protocol.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(protocol.updatedAt) ?? new Date().toISOString(),
  };
}

export function toReportSummary(report: ReportEntity): ReportSummary {
  return {
    id: report._id.toString(),
    status: report.status,
    version: report.version,
    signedOutAt: toIso(report.signedOutAt),
    amendedAt: toIso(report.amendedAt),
    releasedAt: toIso(report.releasedAt),
  };
}

export function toReportVersion(
  version: ReportVersionEntity,
  createdBy: UserEntity | null,
): ReportVersionDto {
  return {
    id: version._id.toString(),
    version: version.version,
    action: version.action,
    data: version.data,
    narrative: version.narrative,
    reason: version.reason,
    createdBy: createdBy ? toUserSummary(createdBy) : null,
    createdAt: toIso(version.createdAt) ?? new Date().toISOString(),
  };
}

export function toReportDetail(
  report: ReportEntity,
  signedOutBy: UserEntity | null,
  versions: ReportVersionDto[],
  releasedBy: UserEntity | null = null,
): ReportDetail {
  const snapshot = report.protocolSnapshot;
  return {
    id: report._id.toString(),
    caseId: report.caseId.toString(),
    status: report.status,
    protocol: {
      id: snapshot.protocolId,
      key: snapshot.key,
      title: snapshot.title,
      cancerType: snapshot.cancerType,
      subspecialty: snapshot.subspecialty,
      version: snapshot.version,
      content: snapshot.content as ProtocolContent,
    },
    protocolVersion: report.protocolVersion,
    data: report.data,
    narrative: report.narrative,
    version: report.version,
    requiredComplete: report.requiredComplete,
    missingRequired: [...report.missingRequired],
    signedOutBy: signedOutBy ? toUserSummary(signedOutBy) : null,
    signedOutAt: toIso(report.signedOutAt),
    amendedAt: toIso(report.amendedAt),
    amendmentReason: report.amendmentReason,
    verificationCode: report.verificationCode,
    coding: (report.coding ?? {
      snomedCode: null,
      snomedDisplay: null,
      icdo3MorphologyCode: null,
      icdo3MorphologyDisplay: null,
      icdo3TopographyCode: null,
      icdo3TopographyDisplay: null,
    }) as ReportCoding,
    releasedAt: toIso(report.releasedAt),
    releasedBy: releasedBy ? toUserSummary(releasedBy) : null,
    createdAt: toIso(report.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(report.updatedAt) ?? new Date().toISOString(),
    versions,
  };
}

export function toCaseListItem(
  caseDoc: CaseEntity,
  patient: PatientEntity,
  pathologist: UserEntity | null,
  report: ReportEntity | null,
): CaseListItem {
  return {
    id: caseDoc._id.toString(),
    accessionNumber: caseDoc.accessionNumber,
    patient: toPatientSummary(patient),
    priority: caseDoc.priority,
    priorityRank: caseDoc.priorityRank,
    status: caseDoc.status,
    subspecialty: caseDoc.subspecialty,
    referringClinician: {
      name: caseDoc.referringClinician.name,
      facility: caseDoc.referringClinician.facility,
      phone: caseDoc.referringClinician.phone,
      email: caseDoc.referringClinician.email,
      referrerUserId: caseDoc.referringClinician.referrerUserId
        ? caseDoc.referringClinician.referrerUserId.toString()
        : null,
    },
    assignedPathologist: pathologist ? toUserSummary(pathologist) : null,
    receivedAt: toIso(caseDoc.receivedAt) ?? new Date().toISOString(),
    tatDeadline: toIso(caseDoc.tatDeadline) ?? new Date().toISOString(),
    reportedAt: toIso(caseDoc.reportedAt),
    amendedAt: toIso(caseDoc.amendedAt),
    tatBreachedAt: toIso(caseDoc.tatBreachedAt),
    summary: {
      specimenCount: caseDoc.summary?.specimenCount ?? 0,
      blockCount: caseDoc.summary?.blockCount ?? 0,
      slideCount: caseDoc.summary?.slideCount ?? 0,
    },
    report: report ? toReportSummary(report) : null,
    createdAt: toIso(caseDoc.createdAt) ?? new Date().toISOString(),
  };
}

export function toAuditLog(log: AuditLogEntity): AuditLogDto {
  return {
    id: log._id.toString(),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    caseId: log.caseId,
    userId: log.userId ? log.userId.toString() : null,
    userName: log.userName,
    userRole: log.userRole,
    before: log.before,
    after: log.after,
    metadata: (log.metadata ?? {}) as Record<string, unknown>,
    ip: log.ip,
    userAgent: log.userAgent,
    requestId: log.requestId,
    createdAt: toIso(log.createdAt) ?? new Date().toISOString(),
  };
}
