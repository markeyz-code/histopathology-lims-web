/**
 * Domain vocabulary shared by the API and the web client.
 * These tuples are the single source of truth; statuses are never free text.
 */

export const ROLES = [
  'SUPER_ADMIN',
  'LAB_ADMIN',
  'RECEPTIONIST',
  'GROSSER',
  'TECHNOLOGIST',
  'PATHOLOGIST',
  'REFERRER',
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super administrator',
  LAB_ADMIN: 'Laboratory administrator',
  RECEPTIONIST: 'Receptionist',
  GROSSER: 'Grossing officer',
  TECHNOLOGIST: 'Medical laboratory scientist',
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
  ],
  RECEPTIONIST: ['dashboard', 'accession', 'cases', 'locator', 'labels'],
  GROSSER: ['dashboard', 'cases', 'scan', 'grossing', 'locator', 'labels'],
  TECHNOLOGIST: ['dashboard', 'cases', 'scan', 'lab_work', 'locator', 'labels'],
  PATHOLOGIST: [
    'dashboard',
    'cases',
    'scan',
    'pathologist_desk',
    'reports',
    'worklist',
    'locator',
    'labels',
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
