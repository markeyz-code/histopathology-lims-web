/**
 * Domain vocabulary shared by the API and the web client.
 * These tuples are the single source of truth; statuses are never free text.
 */

export const ROLES = [
  'SUPER_ADMIN',
  'LAB_ADMIN',
  'RECEPTIONIST',
  'PHLEBOTOMIST',
  'GROSSER',
  'TECHNOLOGIST',
  'SCIENTIST',
  'PATHOLOGIST',
  'REFERRER',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super administrator',
  LAB_ADMIN: 'Laboratory administrator',
  RECEPTIONIST: 'Receptionist',
  PHLEBOTOMIST: 'Phlebotomist',
  GROSSER: 'Grossing officer',
  TECHNOLOGIST: 'Medical laboratory scientist',
  SCIENTIST: 'Laboratory scientist',
  PATHOLOGIST: 'Pathologist',
  REFERRER: 'Referring clinician',
};

export const CASE_STATUSES = [
  'RECEIVED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'REPORTED',
  'AMENDED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  RECEIVED: 'Received',
  IN_PROGRESS: 'In progress',
  PENDING_REVIEW: 'Pending review',
  REPORTED: 'Reported',
  AMENDED: 'Amended',
};

export const PRIORITIES = ['ROUTINE', 'URGENT', 'FROZEN'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  ROUTINE: 'Routine',
  URGENT: 'Urgent',
  FROZEN: 'Frozen section',
};

/** Frozen first, then urgent, then routine. Stored on the case for index-friendly sorting. */
export const PRIORITY_RANK: Record<Priority, number> = {
  FROZEN: 0,
  URGENT: 1,
  ROUTINE: 2,
};

/** Default TAT windows in hours; each lab can override these in settings. */
export const DEFAULT_TAT_HOURS: Record<Priority, number> = {
  FROZEN: 1,
  URGENT: 24,
  ROUTINE: 72,
};

export const DEFAULT_TAT_WARNING_PERCENT = 80;

export const PHYSICAL_ENTITY_TYPES = ['SPECIMEN', 'BLOCK', 'SLIDE'] as const;
export type PhysicalEntityType = (typeof PHYSICAL_ENTITY_TYPES)[number];

export const CUSTODY_ENTITY_TYPES = ['SPECIMEN', 'BLOCK', 'SLIDE', 'CASE'] as const;
export type CustodyEntityType = (typeof CUSTODY_ENTITY_TYPES)[number];

/** States of a physical entity. The value is always derived from the latest custody event. */
export const PHYSICAL_STATES = [
  'ACCESSIONED',
  'GROSSED',
  'PROCESSING',
  'EMBEDDED',
  'CUT',
  'STAINED',
  'WITH_PATHOLOGIST',
  'REPORTED',
  'ARCHIVED',
  'RECUT_REQUESTED',
  'REJECTED',
] as const;
export type PhysicalState = (typeof PHYSICAL_STATES)[number];

export const PHYSICAL_STATE_LABELS: Record<PhysicalState, string> = {
  ACCESSIONED: 'Accessioned',
  GROSSED: 'Grossed',
  PROCESSING: 'Processing',
  EMBEDDED: 'Embedded',
  CUT: 'Cut',
  STAINED: 'Stained',
  WITH_PATHOLOGIST: 'With pathologist',
  REPORTED: 'Reported',
  ARCHIVED: 'Archived',
  RECUT_REQUESTED: 'Recut requested',
  REJECTED: 'Rejected',
};

export const CASE_EVENT_TYPES = ['RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW', 'AMENDED'] as const;
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number] | 'REPORTED';

export type CustodyEventType = PhysicalState | CaseEventType;

export const STATIONS = [
  'GROSSING',
  'PROCESSING',
  'EMBEDDING',
  'MICROTOMY',
  'STAINING',
  'PATHOLOGIST',
  'ARCHIVE',
] as const;
export type Station = (typeof STATIONS)[number];

export const STATION_LABELS: Record<Station, string> = {
  GROSSING: 'Grossing',
  PROCESSING: 'Processing',
  EMBEDDING: 'Embedding',
  MICROTOMY: 'Microtomy',
  STAINING: 'Staining',
  PATHOLOGIST: 'Pathologist desk',
  ARCHIVE: 'Archive',
};

export const STATION_DESCRIPTIONS: Record<Station, string> = {
  GROSSING: 'Confirm specimens and scan cassettes after grossing',
  PROCESSING: 'Move cassettes into the processor',
  EMBEDDING: 'Scan cassettes after wax embedding',
  MICROTOMY: 'Scan blocks before cutting; cut and label slides',
  STAINING: 'Scan every slide through H&E or special stains',
  PATHOLOGIST: 'Scan slides onto your desk for review',
  ARCHIVE: 'Archive reported blocks and slides',
};

export const STATION_TARGET: Record<Station, Partial<Record<PhysicalEntityType, PhysicalState>>> = {
  GROSSING: { SPECIMEN: 'GROSSED', BLOCK: 'GROSSED' },
  PROCESSING: { BLOCK: 'PROCESSING' },
  EMBEDDING: { BLOCK: 'EMBEDDED' },
  MICROTOMY: { BLOCK: 'CUT', SLIDE: 'CUT' },
  STAINING: { SLIDE: 'STAINED' },
  PATHOLOGIST: { SLIDE: 'WITH_PATHOLOGIST' },
  ARCHIVE: { BLOCK: 'ARCHIVED', SLIDE: 'ARCHIVED' },
};

export const STATION_ROLES: Record<Station, Role[]> = {
  GROSSING: ['GROSSER', 'LAB_ADMIN', 'SUPER_ADMIN'],
  PROCESSING: ['TECHNOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN'],
  EMBEDDING: ['TECHNOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN'],
  MICROTOMY: ['TECHNOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN'],
  STAINING: ['TECHNOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN'],
  PATHOLOGIST: ['PATHOLOGIST', 'SUPER_ADMIN'],
  ARCHIVE: ['TECHNOLOGIST', 'LAB_ADMIN', 'SUPER_ADMIN'],
};

export const STAIN_TYPES = ['H_AND_E', 'SPECIAL', 'IMMUNOHISTOCHEMISTRY'] as const;
export type StainType = (typeof STAIN_TYPES)[number];

export const STAIN_TYPE_LABELS: Record<StainType, string> = {
  H_AND_E: 'H&E',
  SPECIAL: 'Special stain',
  IMMUNOHISTOCHEMISTRY: 'Immunohistochemistry',
};

export const REPORT_STATUSES = ['DRAFT', 'SIGNED_OUT', 'AMENDED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: 'Draft',
  SIGNED_OUT: 'Signed out',
  AMENDED: 'Amended',
};

export const SEXES = ['FEMALE', 'MALE', 'OTHER', 'UNKNOWN'] as const;
export type Sex = (typeof SEXES)[number];

export const SEX_LABELS: Record<Sex, string> = {
  FEMALE: 'Female',
  MALE: 'Male',
  OTHER: 'Other',
  UNKNOWN: 'Unknown',
};

export const SUBSPECIALTIES = [
  'Breast',
  'Gastrointestinal',
  'Urology',
  'Gynaecology',
  'Dermatopathology',
  'Haematopathology',
  'Neuropathology',
  'Paediatric pathology',
  'Head and neck',
  'Other',
] as const;
export type Subspecialty = (typeof SUBSPECIALTIES)[number];

export const SPECIMEN_TYPE_PRESETS = [
  'Core biopsy',
  'Incision biopsy',
  'Excision biopsy',
  'Wide local excision',
  'Mastectomy',
  'Hysterectomy',
  'Colectomy',
  'Gastrectomy',
  'Prostatectomy',
  'TURP chips',
  'Lymph node',
  'Cytology cell block',
  'Product of conception',
  'Other',
] as const;

export const LATERALITIES = ['LEFT', 'RIGHT', 'BILATERAL', 'NOT_APPLICABLE'] as const;
export type Laterality = (typeof LATERALITIES)[number];

export const LATERALITY_LABELS: Record<Laterality, string> = {
  LEFT: 'Left',
  RIGHT: 'Right',
  BILATERAL: 'Bilateral',
  NOT_APPLICABLE: 'Not applicable',
};

export const CAPABILITIES = [
  'dashboard',
  'accession',
  'cases',
  'scan',
  'grossing',
  'lab_work',
  'pathologist_desk',
  'reports',
  'worklist',
  'locator',
  'labels',
  'admin',
  'audit',
  'referrer',
  'inventory',
  'qa',
  'billing',
  'interop',
  'collection',
  'results',
  'verification',
  'disciplines',
  'qc',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  SUPER_ADMIN: CAPABILITIES,
  LAB_ADMIN: [
    'dashboard',
    'accession',
    'cases',
    'scan',
    'grossing',
    'lab_work',
    'reports',
    'worklist',
    'locator',
    'labels',
    'admin',
    'audit',
    'inventory',
    'qa',
    'billing',
    'interop',
    'collection',
    'results',
    'verification',
    'disciplines',
    'qc',
  ],
  RECEPTIONIST: ['dashboard', 'accession', 'cases', 'locator', 'labels', 'billing', 'collection'],
  PHLEBOTOMIST: ['dashboard', 'cases', 'locator', 'labels', 'collection'],
  GROSSER: ['dashboard', 'cases', 'scan', 'grossing', 'locator', 'labels'],
  TECHNOLOGIST: [
    'dashboard',
    'cases',
    'scan',
    'lab_work',
    'locator',
    'labels',
    'inventory',
    'results',
    'qc',
  ],
  SCIENTIST: [
    'dashboard',
    'cases',
    'scan',
    'lab_work',
    'locator',
    'labels',
    'results',
    'verification',
    'qc',
  ],
  PATHOLOGIST: [
    'dashboard',
    'cases',
    'scan',
    'pathologist_desk',
    'reports',
    'worklist',
    'locator',
    'labels',
    'qa',
    'results',
    'verification',
    'disciplines',
    'qc',
  ],
  REFERRER: ['referrer'],
};

export function roleHasCapability(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].includes(capability);
}

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'SCAN',
  'SIGN_OUT',
  'AMEND',
  'LOGIN',
  'LOGOUT',
  'RELEASE',
  'PAYMENT',
  'WEBHOOK',
  'SYNC',
  'QA',
  'EXPORT',
  'NOTIFY',
  'IMPORT',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Barcode prefixes are intentionally short for 2D symbol density. */
export const BARCODE_PREFIXES = {
  SPECIMEN: 'SP',
  BLOCK: 'BL',
  SLIDE: 'SL',
} as const;

export const LABEL_FORMATS = ['pdf', 'zpl', 'svg'] as const;
export type LabelFormat = (typeof LABEL_FORMATS)[number];

export const LABEL_SYMBOLOGIES = ['datamatrix', 'qr'] as const;
export type LabelSymbology = (typeof LABEL_SYMBOLOGIES)[number];

export const DEFAULT_ACCESSION_FORMAT = '{PREFIX}-{YYYY}-{SEQ:6}';
export const DEFAULT_ACCESSION_PREFIX = 'HP';
export const MAX_BLOCK_COUNT = 30;
export const MAX_SLIDE_COUNT = 20;

// ─────────────────────────────────────────────────────────────
// Phase 2 — notifications, referral access, inventory and QA
// ─────────────────────────────────────────────────────────────

export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['QUEUED', 'SENDING', 'SENT', 'FAILED', 'SKIPPED'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const PORTAL_TOKEN_TYPES = ['MAGIC_LINK', 'OTP'] as const;
export type PortalTokenType = (typeof PORTAL_TOKEN_TYPES)[number];

export const REFERRAL_STATUSES = [
  'RECEIVED',
  'IN_PROGRESS',
  'READY',
  'RELEASED',
  'AMENDED',
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REAGENT_CATEGORIES = ['REAGENT', 'ANTIBODY', 'CONSUMABLE'] as const;
export type ReagentCategory = (typeof REAGENT_CATEGORIES)[number];

export const REAGENT_CATEGORY_LABELS: Record<ReagentCategory, string> = {
  REAGENT: 'Reagent',
  ANTIBODY: 'Antibody',
  CONSUMABLE: 'Consumable',
};

export const REAGENT_LOT_STATUSES = [
  'QUARANTINED',
  'ACTIVE',
  'EXPIRED',
  'DEPLETED',
  'REJECTED',
] as const;
export type ReagentLotStatus = (typeof REAGENT_LOT_STATUSES)[number];

export const REAGENT_LOT_STATUS_LABELS: Record<ReagentLotStatus, string> = {
  QUARANTINED: 'Quarantined',
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  DEPLETED: 'Depleted',
  REJECTED: 'Rejected',
};

export const LOT_VALIDATION_STATUSES = ['PENDING', 'VALIDATED', 'FAILED'] as const;
export type LotValidationStatus = (typeof LOT_VALIDATION_STATUSES)[number];

export const STAIN_RUN_STATUSES = ['PLANNED', 'RUNNING', 'COMPLETED', 'FAILED', 'QC_HOLD'] as const;
export type StainRunStatus = (typeof STAIN_RUN_STATUSES)[number];

export const STAIN_QC_RESULTS = ['PENDING', 'PASS', 'FAIL'] as const;
export type StainQcResult = (typeof STAIN_QC_RESULTS)[number];

export const REJECTION_REASON_CODES = [
  'MISLABELLED',
  'WRONG_CONTAINER',
  'FIXATION_DELAY',
  'INSUFFICIENT_TISSUE',
  'CONTAMINATION',
  'BROKEN_SLIDE',
  'LOST_IN_PROCESSING',
  'UNREPRESENTATIVE',
  'OTHER',
] as const;
export type RejectionReasonCode = (typeof REJECTION_REASON_CODES)[number];

export const REJECTION_REASON_LABELS: Record<RejectionReasonCode, string> = {
  MISLABELLED: 'Mislabelled or unidentified',
  WRONG_CONTAINER: 'Wrong container or fixative',
  FIXATION_DELAY: 'Fixation delay',
  INSUFFICIENT_TISSUE: 'Insufficient tissue',
  CONTAMINATION: 'Contamination',
  BROKEN_SLIDE: 'Broken slide',
  LOST_IN_PROCESSING: 'Lost in processing',
  UNREPRESENTATIVE: 'Unrepresentative sample',
  OTHER: 'Other (explain)',
};

export const QA_REVIEW_TYPES = ['PEER_REVIEW', 'SECOND_OPINION', 'DISCREPANCY'] as const;
export type QaReviewType = (typeof QA_REVIEW_TYPES)[number];

export const QA_REVIEW_STATUSES = [
  'PENDING',
  'ASSIGNED',
  'IN_REVIEW',
  'AGREED',
  'DISCREPANT',
  'CLOSED',
  'CANCELLED',
] as const;
export type QaReviewStatus = (typeof QA_REVIEW_STATUSES)[number];

export const QA_DISCREPANCY_CODES = [
  'NONE',
  'MAJOR_DIAGNOSTIC',
  'MINOR_DIAGNOSTIC',
  'GRADING',
  'STAGING',
  'BIOMARKER',
  'MARGIN',
  'LYMPH_NODE',
  'TRANSCRIPTION',
  'OTHER',
] as const;
export type QaDiscrepancyCode = (typeof QA_DISCREPANCY_CODES)[number];

export const QA_DISCREPANCY_LABELS: Record<QaDiscrepancyCode, string> = {
  NONE: 'No discrepancy',
  MAJOR_DIAGNOSTIC: 'Major diagnostic disagreement',
  MINOR_DIAGNOSTIC: 'Minor diagnostic disagreement',
  GRADING: 'Grade disagreement',
  STAGING: 'Stage disagreement',
  BIOMARKER: 'Biomarker / IHC disagreement',
  MARGIN: 'Margin disagreement',
  LYMPH_NODE: 'Lymph node count disagreement',
  TRANSCRIPTION: 'Transcription error',
  OTHER: 'Other',
};

export const QA_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;
export type QaSeverity = (typeof QA_SEVERITIES)[number];

export const DEFAULT_QA_SAMPLING_PERCENT = 10;

// ─────────────────────────────────────────────────────────────
// Phase 3 — coding, imaging, payments, sync and interoperability
// ─────────────────────────────────────────────────────────────

export const CODING_SYSTEMS = ['SNOMED_CT', 'ICD_O_3_MORPHOLOGY', 'ICD_O_3_TOPOGRAPHY'] as const;
export type CodingSystem = (typeof CODING_SYSTEMS)[number];

export const CODING_SYSTEM_LABELS: Record<CodingSystem, string> = {
  SNOMED_CT: 'SNOMED CT',
  ICD_O_3_MORPHOLOGY: 'ICD-O-3 morphology',
  ICD_O_3_TOPOGRAPHY: 'ICD-O-3 topography',
};

export const WSI_STATUSES = ['LINKED', 'PROCESSING', 'FAILED'] as const;
export type WsiStatus = (typeof WSI_STATUSES)[number];

export const PAYER_TYPES = ['SELF', 'HMO', 'CORPORATE', 'INSURANCE', 'WAIVER'] as const;
export type PayerType = (typeof PAYER_TYPES)[number];

export const PAYER_TYPE_LABELS: Record<PayerType, string> = {
  SELF: 'Self-pay',
  HMO: 'HMO',
  CORPORATE: 'Corporate',
  INSURANCE: 'Insurance',
  WAIVER: 'Waiver',
};

export const INVOICE_STATUSES = [
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'VOID',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  VOID: 'Void',
};

export const PAYMENT_PROVIDERS = ['PAYSTACK', 'FLUTTERWAVE', 'CASH', 'TRANSFER', 'HMO'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_MODES = ['MOCK', 'LIVE'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const CLAIM_STATUSES = [
  'DRAFT',
  'READY',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
  'PAID',
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const SYNC_MUTATION_TYPES = ['SCAN', 'REJECT', 'RECUT'] as const;
export type SyncMutationType = (typeof SYNC_MUTATION_TYPES)[number];

// ─────────────────────────────────────────────────────────────
// Multi-discipline platform
// ─────────────────────────────────────────────────────────────

export const DISCIPLINES = [
  'HISTOPATHOLOGY',
  'HAEMATOLOGY',
  'CHEMICAL_PATHOLOGY',
  'MICROBIOLOGY',
] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  HISTOPATHOLOGY: 'Histopathology',
  HAEMATOLOGY: 'Haematology',
  CHEMICAL_PATHOLOGY: 'Chemical pathology',
  MICROBIOLOGY: 'Medical microbiology',
};

export const DISCIPLINE_SHORT_LABELS: Record<Discipline, string> = {
  HISTOPATHOLOGY: 'Histo',
  HAEMATOLOGY: 'Haem',
  CHEMICAL_PATHOLOGY: 'Chem',
  MICROBIOLOGY: 'Micro',
};

/** Optional per-discipline prefix override; empty means use the lab accession prefix. */
export const DISCIPLINE_ACCESSION_PREFIXES: Record<Discipline, string> = {
  HISTOPATHOLOGY: 'HP',
  HAEMATOLOGY: 'HAE',
  CHEMICAL_PATHOLOGY: 'CHM',
  MICROBIOLOGY: 'MIC',
};

export const TEST_REQUEST_STATUSES = [
  'RECEIVED',
  'COLLECTED',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'RESULTED',
  'VERIFIED',
  'RELEASED',
  'CANCELLED',
] as const;
export type TestRequestStatus = (typeof TEST_REQUEST_STATUSES)[number];

export const TEST_REQUEST_STATUS_LABELS: Record<TestRequestStatus, string> = {
  RECEIVED: 'Received',
  COLLECTED: 'Collected',
  IN_PROGRESS: 'In progress',
  PENDING_REVIEW: 'Pending review',
  RESULTED: 'Resulted',
  VERIFIED: 'Verified',
  RELEASED: 'Released',
  CANCELLED: 'Cancelled',
};

export const HAEMATOLOGY_SAMPLE_STATES = [
  'COLLECTED',
  'RECEIVED',
  'ANALYSING',
  'RESULTED',
  'VERIFIED',
  'RELEASED',
  'REJECTED',
  'RERUN_REQUESTED',
] as const;
export type HaematologySampleState = (typeof HAEMATOLOGY_SAMPLE_STATES)[number];

export const CHEMISTRY_SAMPLE_STATES = HAEMATOLOGY_SAMPLE_STATES;
export type ChemistrySampleState = (typeof CHEMISTRY_SAMPLE_STATES)[number];

export const MICROBIOLOGY_CULTURE_STATES = [
  'RECEIVED',
  'PLATED',
  'INCUBATING',
  'READ',
  'ID_DONE',
  'AST_DONE',
  'REPORTED',
  'REJECTED',
] as const;
export type MicrobiologyCultureState = (typeof MICROBIOLOGY_CULTURE_STATES)[number];

export const DISCIPLINE_STATE_LABELS: Record<string, string> = {
  COLLECTED: 'Collected',
  RECEIVED: 'Received',
  ANALYSING: 'Analysing',
  RESULTED: 'Resulted',
  VERIFIED: 'Verified',
  RELEASED: 'Released',
  REJECTED: 'Rejected',
  RERUN_REQUESTED: 'Rerun requested',
  PLATED: 'Plated',
  INCUBATING: 'Incubating',
  READ: 'Read',
  ID_DONE: 'Identification done',
  AST_DONE: 'Susceptibility done',
  REPORTED: 'Reported',
};

/** All roles that are scoped to one or more disciplines. */
export const CLINICAL_ROLES = ['GROSSER', 'TECHNOLOGIST', 'SCIENTIST', 'PATHOLOGIST'] as const;
export type ClinicalRole = (typeof CLINICAL_ROLES)[number];

export function isClinicalRole(role: Role): role is ClinicalRole {
  return (CLINICAL_ROLES as readonly string[]).includes(role);
}

// ─────────────────────────────────────────────────────────────
// Phase 2 — results, catalogue, rules and QC
// ─────────────────────────────────────────────────────────────

export const RESULT_TYPES = ['NUMERIC', 'CODED', 'TEXT', 'CALCULATED'] as const;
export type ResultType = (typeof RESULT_TYPES)[number];

export const RESULT_STATUSES = ['DRAFT', 'RESULTED', 'VERIFIED', 'RELEASED', 'CANCELLED'] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export const RESULT_STATUS_LABELS: Record<ResultStatus, string> = {
  DRAFT: 'Draft',
  RESULTED: 'Resulted',
  VERIFIED: 'Verified',
  RELEASED: 'Released',
  CANCELLED: 'Cancelled',
};

export const RESULT_FLAGS = [
  'NORMAL',
  'LOW',
  'HIGH',
  'CRITICAL_LOW',
  'CRITICAL_HIGH',
  'ABNORMAL',
] as const;
export type ResultFlag = (typeof RESULT_FLAGS)[number];

export const RESULT_FLAG_LABELS: Record<ResultFlag, string> = {
  NORMAL: 'Normal',
  LOW: 'Low',
  HIGH: 'High',
  CRITICAL_LOW: 'Critical low',
  CRITICAL_HIGH: 'Critical high',
  ABNORMAL: 'Abnormal',
};

export const RULE_TRIGGERS = ['RESULT_SAVE', 'RESULT_VERIFY', 'RESULT_RELEASE'] as const;
export type RuleTrigger = (typeof RULE_TRIGGERS)[number];

export const RULE_ACTIONS = [
  'AUTO_VERIFY',
  'CRITICAL_ALERT',
  'REFLEX_TEST',
  'DELTA_CHECK',
  'CASCADE_ANTIBIOTIC',
  'REQUIRE_REVIEW',
] as const;
export type RuleAction = (typeof RULE_ACTIONS)[number];

export const RULE_ACTION_LABELS: Record<RuleAction, string> = {
  AUTO_VERIFY: 'Auto-verify',
  CRITICAL_ALERT: 'Critical-value alert',
  REFLEX_TEST: 'Reflex test',
  DELTA_CHECK: 'Delta check',
  CASCADE_ANTIBIOTIC: 'Cascade antibiotic',
  REQUIRE_REVIEW: 'Require review',
};

export const WESTGARD_RULES = ['1_3S', '2_2S', 'R_4S', '4_1S', '10X'] as const;
export type WestgardRule = (typeof WESTGARD_RULES)[number];

export const WESTGARD_RULE_LABELS: Record<WestgardRule, string> = {
  '1_3S': '1₃s — one point beyond 3 SD',
  '2_2S': '2₂s — two consecutive beyond 2 SD, same side',
  R_4S: 'R₄s — range between two points exceeds 4 SD',
  '4_1S': '4₁s — four consecutive beyond 1 SD, same side',
  '10X': '10x — ten consecutive on one side of the mean',
};

export const QC_STATUSES = ['ACCEPTED', 'WARNING', 'REJECTED'] as const;
export type QcStatus = (typeof QC_STATUSES)[number];

export const QC_LEVELS = ['LOW', 'NORMAL', 'HIGH'] as const;
export type QcLevel = (typeof QC_LEVELS)[number];
