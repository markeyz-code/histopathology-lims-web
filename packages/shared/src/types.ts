import type {
  AuditAction,
  CaseStatus,
  Laterality,
  PhysicalEntityType,
  PhysicalState,
  PhysicalState as EntityState,
  Priority,
  ReportStatus,
  Role,
  Sex,
  StainType,
  Station,
} from './constants';
import type { ProtocolContent, ReportData } from './protocol';
import type { TatInfo } from './tat';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  subspecialties: string[];
}

export interface User extends UserSummary {
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Letterhead {
  phone: string | null;
  email: string | null;
  website: string | null;
  pathologistName: string | null;
  pathologistTitle: string | null;
  qualifications: string | null;
  signatureText: string | null;
  footerNote: string | null;
}

export interface Lab {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  accessionPrefix: string;
  accessionFormat: string;
  tatHours: Record<Priority, number>;
  tatWarningPercent: number;
  timezone: string;
  letterhead: Letterhead;
  active: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  lab: Lab;
}

export interface PatientSummary {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  sex: Sex;
  dateOfBirth: string | null;
  age: number | null;
}

export interface NextOfKin {
  name: string | null;
  phone: string | null;
  relationship: string | null;
}

export interface Patient extends PatientSummary {
  phone: string | null;
  email: string | null;
  address: string | null;
  nationalId: string | null;
  nextOfKin: NextOfKin | null;
  createdAt: string;
}

export interface ReferringClinician {
  name: string;
  facility: string | null;
  phone: string | null;
  email: string | null;
  referrerUserId: string | null;
}

export interface Specimen {
  id: string;
  caseId: string;
  sequence: number;
  label: string;
  barcode: string;
  specimenType: string;
  site: string;
  laterality: Laterality | null;
  description: string | null;
  collectedAt: string | null;
  receivedAt: string;
  grossDescription: string | null;
  status: EntityState;
  currentStation: Station | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface Block {
  id: string;
  caseId: string;
  specimenId: string;
  specimenLabel: string;
  blockNumber: number;
  label: string;
  barcode: string;
  grossDescription: string | null;
  status: EntityState;
  currentStation: Station | null;
  slideCount: number;
  lastEventAt: string | null;
  createdAt: string;
}

export interface Slide {
  id: string;
  caseId: string;
  specimenId: string;
  blockId: string;
  blockLabel: string;
  slideNumber: number;
  label: string;
  barcode: string;
  stainType: StainType;
  specialStain: string | null;
  status: EntityState;
  currentStation: Station | null;
  recutOfSlideId: string | null;
  requestReason: string | null;
  notes: string | null;
  lastEventAt: string | null;
  createdAt: string;
}

export interface CustodyEvent {
  id: string;
  entityType: PhysicalEntityType | 'CASE';
  entityId: string;
  caseId: string | null;
  eventType: string;
  station: Station | null;
  fromState: string | null;
  toState: string;
  reason: string | null;
  userId: string;
  userName: string;
  userRole: Role;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface ReportSummary {
  id: string;
  status: ReportStatus;
  version: number;
  signedOutAt: string | null;
  amendedAt: string | null;
}

export interface ReportProtocolSnapshot {
  id: string;
  key: string;
  title: string;
  cancerType: string;
  subspecialty: string;
  version: number;
  content: ProtocolContent;
}

export interface ReportVersion {
  id: string;
  version: number;
  action: 'SIGN_OUT' | 'AMEND';
  data: ReportData;
  narrative: string;
  reason: string | null;
  createdBy: UserSummary | null;
  createdAt: string;
}

export interface ReportDetail {
  id: string;
  caseId: string;
  status: ReportStatus;
  protocol: ReportProtocolSnapshot;
  protocolVersion: number;
  data: ReportData;
  narrative: string;
  version: number;
  requiredComplete: boolean;
  missingRequired: string[];
  signedOutBy: UserSummary | null;
  signedOutAt: string | null;
  amendedAt: string | null;
  amendmentReason: string | null;
  verificationCode: string | null;
  createdAt: string;
  updatedAt: string;
  versions: ReportVersion[];
}

export interface CaseSummaryCounts {
  specimenCount: number;
  blockCount: number;
  slideCount: number;
}

export interface CaseListItem {
  id: string;
  accessionNumber: string;
  patient: PatientSummary;
  priority: Priority;
  priorityRank: number;
  status: CaseStatus;
  subspecialty: string | null;
  referringClinician: ReferringClinician;
  assignedPathologist: UserSummary | null;
  receivedAt: string;
  tatDeadline: string;
  reportedAt: string | null;
  amendedAt: string | null;
  tatBreachedAt: string | null;
  summary: CaseSummaryCounts;
  report: ReportSummary | null;
  createdAt: string;
}

export interface CaseDetail extends CaseListItem {
  clinicalHistory: string;
  clinicalDiagnosis: string | null;
  specimens: Specimen[];
  blocks: Block[];
  slides: Slide[];
  custodyEvents: CustodyEvent[];
  report: ReportDetail | null;
  tat: TatInfo;
}

export interface Protocol {
  id: string;
  key: string;
  title: string;
  cancerType: string;
  subspecialty: string;
  version: number;
  active: boolean;
  content: ProtocolContent;
  createdAt: string;
  updatedAt: string;
}

export interface WorklistItem {
  case: CaseListItem;
  totalSlides: number;
  pendingSlides: number;
  stainedSlides: number;
  tat: TatInfo;
  reportStatus: ReportStatus | null;
}

export interface WorklistResult {
  items: WorklistItem[];
  total: number;
  generatedAt: string;
  summary: {
    frozen: number;
    urgent: number;
    overdue: number;
    awaitingReview: number;
  };
}

export interface ScanEntity {
  entityType: PhysicalEntityType;
  id: string;
  barcode: string;
  label: string;
  status: PhysicalState;
  currentStation: Station | null;
  caseId: string;
  accessionNumber: string;
  patientName: string;
  caseStatus: CaseStatus;
}

export interface ScanResponse {
  entity: ScanEntity;
  transition: {
    from: PhysicalState;
    to: PhysicalState;
    eventType: string;
    station: Station;
  };
  message: string;
  nextHint: string;
  timestamp: string;
}

export interface LocatorCase {
  id: string;
  accessionNumber: string;
  status: CaseStatus;
  priority: Priority;
  patientName: string;
  patientMrn: string;
  tatDeadline: string;
}

export interface LocatorResult {
  entityType: PhysicalEntityType;
  entity: Specimen | Block | Slide;
  case: LocatorCase;
  specimen: Specimen | null;
  block: Block | null;
  timeline: CustodyEvent[];
  currentLocation: { station: Station | null; label: string } | null;
}

export interface StageTat {
  key: string;
  label: string;
  averageHours: number | null;
  samples: number;
}

export interface WorkloadRow {
  pathologistId: string;
  name: string;
  activeCases: number;
  pendingReview: number;
  reportedInRange: number;
}

export interface DashboardAlert {
  caseId: string;
  accessionNumber: string;
  patientName: string;
  priority: Priority;
  tatDeadline: string;
  hoursOverdue: number;
}

export interface DashboardSummary {
  generatedAt: string;
  rangeDays: number;
  totals: {
    cases: number;
    active: number;
    overdue: number;
    reportedInRange: number;
    reportedToday: number;
    averageTatHours: number | null;
  };
  casesByStatus: { status: CaseStatus; count: number }[];
  casesByPriority: { priority: Priority; count: number }[];
  stageTat: StageTat[];
  workload: WorkloadRow[];
  recentCases: CaseListItem[];
  alerts: DashboardAlert[];
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  caseId: string | null;
  userId: string | null;
  userName: string;
  userRole: Role | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface VerifyReportResult {
  valid: true;
  labName: string;
  labCode: string;
  accessionNumber: string;
  patientInitials: string;
  status: ReportStatus;
  signedOutAt: string | null;
  amendedAt: string | null;
  pathologistName: string | null;
  verificationCode: string;
}

export interface PdfJobResult {
  queued: boolean;
  reportId: string;
  version: number;
}

export interface CaseAccessionResult {
  case: CaseDetail;
  message: string;
}
