import type {
  AuditAction,
  CaseStatus,
  CodingSystem,
  Discipline,
  ConsignmentStatus,
  InvoiceStatus,
  QcLevel,
  QcStatus,
  ResultFlag,
  ResultStatus,
  ResultType,
  RuleAction,
  RuleTrigger,
  WestgardRule,
  Laterality,
  LotValidationStatus,
  PayerType,
  PaymentProvider,
  PaymentStatus,
  ReagentCategory,
  ReagentLotStatus,
  RejectionReasonCode,
  ReferralStatus,
  PhysicalEntityType,
  PhysicalState,
  PhysicalState as EntityState,
  Priority,
  QaDiscrepancyCode,
  QaReviewStatus,
  QaReviewType,
  QaSeverity,
  ReportStatus,
  Role,
  TestRequestStatus,
  Sex,
  StainQcResult,
  StainRunStatus,
  StainType,
  Station,
  SyncMutationType,
} from './constants';
import type { ProtocolContent, ReportData } from './protocol';
import type { TatInfo } from './tat';

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
  subspecialties: string[];
  disciplines: Discipline[];
}

export interface User extends UserSummary {
  phone: string | null;
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
  qaSamplingPercent: number;
  currency: string;
  enabledDisciplines: Discipline[];
  accessionPrefixes: Partial<Record<Discipline, string>>;
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
  rejectionCode: RejectionReasonCode | null;
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
  stainRunId: string | null;
  wsi: WsiInfo | null;
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

export interface ReportCoding {
  snomedCode: string | null;
  snomedDisplay: string | null;
  icdo3MorphologyCode: string | null;
  icdo3MorphologyDisplay: string | null;
  icdo3TopographyCode: string | null;
  icdo3TopographyDisplay: string | null;
}

export interface ReportSummary {
  id: string;
  status: ReportStatus;
  version: number;
  signedOutAt: string | null;
  amendedAt: string | null;
  releasedAt: string | null;
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
  coding: ReportCoding;
  releasedAt: string | null;
  releasedBy: UserSummary | null;
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
  disciplines: Discipline[];
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

export interface TestRequest {
  id: string;
  caseId: string;
  accessionNumber: string;
  discipline: Discipline;
  code: string;
  name: string;
  status: TestRequestStatus;
  priority: Priority;
  requestedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseDetail extends CaseListItem {
  clinicalHistory: string;
  clinicalDiagnosis: string | null;
  specimens: Specimen[];
  testRequests: TestRequest[];
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
  testRequests: TestRequest[];
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

// ─────────────────────────────────────────────────────────────
// Phase 2/3 DTOs
// ─────────────────────────────────────────────────────────────

export interface WsiInfo {
  status: 'LINKED' | 'PROCESSING' | 'FAILED';
  url: string | null;
  viewerUrl: string | null;
  scanner: string | null;
  magnification: string | null;
  addedAt: string | null;
  addedBy: string | null;
  metadata: Record<string, unknown>;
}

export interface NotificationRecord {
  id: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS' | 'WHATSAPP';
  status: 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  type: string;
  title: string;
  body: string;
  recipient: string | null;
  provider: string | null;
  attempts: number;
  lastError: string | null;
  caseId: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  sentAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface PortalResultSummary {
  id: string;
  testCode: string;
  testName: string;
  discipline: Discipline;
  verifiedAt: string | null;
  releasedAt: string;
  downloadUrl: string;
}

export interface PortalCaseSummary {
  id: string;
  accessionNumber: string;
  status: CaseStatus;
  referralStatus: ReferralStatus;
  patientName: string;
  patientMrn: string;
  receivedAt: string;
  reportedAt: string | null;
  releasedAt: string | null;
  priority: Priority;
  reportAvailable: boolean;
  resultsAvailable: boolean;
  releasedResultCount: number;
  downloadUrl: string | null;
}

export interface PortalCaseDetail extends PortalCaseSummary {
  patient: PatientSummary;
  referringClinician: ReferringClinician;
  clinicalHistory: string;
  clinicalDiagnosis: string | null;
  report: ReportDetail | null;
  results: PortalResultSummary[];
  timeline: CustodyEvent[];
}

export interface PortalRequestResult {
  sent: boolean;
  message: string;
  debugCode?: string;
  debugToken?: string;
}

export interface ReagentLot {
  id: string;
  name: string;
  category: ReagentCategory;
  vendor: string;
  catalogNumber: string | null;
  lotNumber: string;
  storageLocation: string | null;
  quantity: number;
  initialQuantity: number;
  unit: string;
  receivedAt: string;
  openedAt: string | null;
  expiresAt: string;
  status: ReagentLotStatus;
  validationStatus: LotValidationStatus;
  validatedAt: string | null;
  validatedBy: UserSummary | null;
  notes: string | null;
  createdAt: string;
}

export interface StainRunLot {
  lotId: string;
  lotNumber: string;
  name: string;
  quantityUsed: number;
}

export interface StainRun {
  id: string;
  caseId: string;
  accessionNumber: string;
  slideLabel: string | null;
  slideId: string | null;
  blockId: string | null;
  stainType: StainType;
  stainName: string;
  status: StainRunStatus;
  qcResult: StainQcResult;
  lots: StainRunLot[];
  equipment: string | null;
  operator: UserSummary | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface QaReview {
  id: string;
  caseId: string;
  accessionNumber: string;
  patientName: string;
  reportId: string | null;
  protocolTitle: string | null;
  type: QaReviewType;
  status: QaReviewStatus;
  reason: string | null;
  requestedBy: UserSummary | null;
  reviewer: UserSummary | null;
  dueAt: string | null;
  originalDiagnosis: string | null;
  reviewDiagnosis: string | null;
  discrepancyCode: QaDiscrepancyCode | null;
  severity: QaSeverity | null;
  findings: string | null;
  actionPlan: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface QaStats {
  pending: number;
  inReview: number;
  agreed: number;
  discrepant: number;
  overdue: number;
  samplingPercent: number;
}

export interface TerminologyCode {
  id: string;
  system: CodingSystem;
  code: string;
  display: string;
  category: string | null;
  synonyms: string[];
  active: boolean;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
}

export interface Invoice {
  id: string;
  number: string;
  caseId: string;
  accessionNumber: string;
  patientName: string;
  payerType: PayerType;
  hmoName: string | null;
  hmoCode: string | null;
  authorizationNumber: string | null;
  status: InvoiceStatus;
  currency: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  dueAt: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amount: number;
  currency: string;
  reference: string;
  providerReference: string | null;
  checkoutUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ClaimRow {
  invoiceNumber: string;
  accessionNumber: string;
  patientName: string;
  hmoName: string | null;
  authorizationNumber: string | null;
  serviceDate: string;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
}

export interface SyncMutation {
  id: string;
  type: SyncMutationType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface SyncMutationResult {
  id: string;
  ok: boolean;
  duplicate: boolean;
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface SyncBatchResult {
  results: SyncMutationResult[];
  syncedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Phase 2 — catalogue, results, rules and QC
// ─────────────────────────────────────────────────────────────

export interface ReferenceRange {
  low: number | null;
  high: number | null;
  sex?: Sex | null;
  minAge?: number | null;
  maxAge?: number | null;
}

export interface AnalyteOption {
  value: string;
  label: string;
}

export interface AnalyteDefinition {
  key: string;
  name: string;
  unit: string | null;
  resultType: ResultType;
  decimals?: number;
  options?: AnalyteOption[];
  referenceRanges: ReferenceRange[];
  criticalLow?: number | null;
  criticalHigh?: number | null;
  formula?: string | null;
  required?: boolean;
}

export interface TestDefinition {
  id: string;
  discipline: Discipline;
  code: string;
  name: string;
  specimenType: string;
  method: string | null;
  analytes: AnalyteDefinition[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Panel {
  id: string;
  discipline: Discipline;
  code: string;
  name: string;
  testCodes: string[];
  active: boolean;
}

export interface ResultValue {
  analyteKey: string;
  analyteName?: string;
  value: number | string | null;
  unit: string | null;
  flag: ResultFlag;
  critical: boolean;
  referenceText: string | null;
}

export interface ResultSet {
  id: string;
  caseId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  testRequestId: string;
  discipline: Discipline;
  testCode: string;
  testName: string;
  status: ResultStatus;
  currentVersion: number;
  values: ResultValue[];
  comment: string | null;
  critical: boolean;
  criticalAcknowledgedAt: string | null;
  criticalAcknowledgedBy: string | null;
  enteredBy: UserSummary | null;
  verifiedBy: UserSummary | null;
  verifiedAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResultVersion {
  id: string;
  resultSetId: string;
  version: number;
  action: 'DRAFT_SAVE' | 'RESULTED' | 'VERIFY' | 'RELEASE' | 'AMEND';
  values: ResultValue[];
  comment: string | null;
  createdBy: UserSummary | null;
  createdAt: string;
}

export interface RuleCondition {
  field?: string;
  op?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'between' | 'contains' | 'exists';
  value?: unknown;
  all?: RuleCondition[];
  any?: RuleCondition[];
  not?: RuleCondition;
}

export interface RuleActionConfig {
  type: RuleAction;
  testCode?: string;
  message?: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface LabRule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discipline: Discipline;
  testCodes: string[];
  trigger: RuleTrigger;
  priority: number;
  active: boolean;
  conditions: RuleCondition;
  actions: RuleActionConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface RuleExecution {
  id: string;
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  resultSetId: string;
  caseId: string;
  trigger: RuleTrigger;
  matched: boolean;
  actions: string[];
  message: string | null;
  createdAt: string;
}

export interface QcMaterial {
  id: string;
  discipline: Discipline;
  name: string;
  lotNumber: string;
  level: QcLevel;
  testCode: string;
  analyteKey: string;
  targetMean: number;
  targetSd: number;
  unit: string | null;
  active: boolean;
}

export interface QcPoint {
  value: number;
  z: number;
}

export interface QcRun {
  id: string;
  materialId: string;
  materialName: string;
  testCode: string;
  analyteKey: string;
  mean: number;
  sd: number;
  values: number[];
  points: QcPoint[];
  status: QcStatus;
  violations: Array<{ rule: WestgardRule; message: string }>;
  performedBy: UserSummary | null;
  createdAt: string;
}

export interface ResultWorklistItem {
  testRequest: TestRequest;
  result: ResultSet | null;
  testDefinition: TestDefinition | null;
}

export interface CumulativeResult {
  testCode: string;
  testName: string;
  discipline: Discipline;
  latest: ResultSet;
  history: ResultSet[];
}

export interface CumulativeReport {
  patient: PatientSummary;
  from: string;
  to: string;
  disciplines: Discipline[];
  results: CumulativeResult[];
}

export interface CollectionCentre {
  id: string;
  code: string;
  name: string;
  address: string | null;
  phone: string | null;
  homeCollection: boolean;
  active: boolean;
}

export interface Consignment {
  id: string;
  code: string;
  centreId: string;
  centreName: string;
  riderName: string | null;
  riderPhone: string | null;
  status: ConsignmentStatus;
  testRequestIds: string[];
  testRequestCount: number;
  dispatchedAt: string | null;
  receivedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
}
