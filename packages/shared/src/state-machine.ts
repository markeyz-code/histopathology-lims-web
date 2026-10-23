import {
  PHYSICAL_STATE_LABELS,
  STATION_TARGET,
  type CaseStatus,
  type PhysicalEntityType,
  type PhysicalState,
  type Station,
} from './constants';

type TransitionTable = Partial<Record<PhysicalState, readonly PhysicalState[]>>;

/**
 * The physical workflow is a state machine, not a set of editable status fields.
 * A transition is legal only if it appears here. Every scan or system action that
 * changes an entity's state writes an immutable custody event and projects the new
 * state onto the entity inside the same transaction.
 */
export const PHYSICAL_TRANSITIONS: Record<PhysicalEntityType, TransitionTable> = {
  SPECIMEN: {
    ACCESSIONED: ['GROSSED', 'REJECTED'],
    GROSSED: ['ARCHIVED', 'REJECTED'],
  },
  BLOCK: {
    ACCESSIONED: ['GROSSED', 'REJECTED'],
    GROSSED: ['PROCESSING', 'REJECTED'],
    PROCESSING: ['EMBEDDED', 'REJECTED'],
    EMBEDDED: ['CUT', 'REJECTED'],
    CUT: ['REPORTED', 'ARCHIVED', 'REJECTED'],
    REPORTED: ['ARCHIVED'],
    REJECTED: ['PROCESSING', 'ARCHIVED'],
  },
  SLIDE: {
    ACCESSIONED: ['CUT', 'REJECTED'],
    CUT: ['STAINED', 'RECUT_REQUESTED', 'REJECTED'],
    STAINED: ['WITH_PATHOLOGIST', 'RECUT_REQUESTED', 'REJECTED'],
    WITH_PATHOLOGIST: ['REPORTED', 'RECUT_REQUESTED'],
    RECUT_REQUESTED: ['CUT'],
    REPORTED: ['ARCHIVED'],
    REJECTED: ['STAINED', 'ARCHIVED'],
  },
};

export const CASE_TRANSITIONS: Record<CaseStatus, readonly CaseStatus[]> = {
  RECEIVED: ['IN_PROGRESS'],
  IN_PROGRESS: ['PENDING_REVIEW', 'REPORTED'],
  PENDING_REVIEW: ['REPORTED'],
  REPORTED: ['AMENDED'],
  AMENDED: [],
};

export const CASE_STATUS_RANK: Record<CaseStatus, number> = {
  RECEIVED: 0,
  IN_PROGRESS: 1,
  PENDING_REVIEW: 2,
  REPORTED: 3,
  AMENDED: 4,
};

export interface TransitionCheck {
  ok: boolean;
  reason?: string;
}

export function isPhysicalEntityType(value: string): value is PhysicalEntityType {
  return value === 'SPECIMEN' || value === 'BLOCK' || value === 'SLIDE';
}

export function allowedNextStates(
  entityType: PhysicalEntityType,
  from: PhysicalState,
): readonly PhysicalState[] {
  return PHYSICAL_TRANSITIONS[entityType][from] ?? [];
}

export function canTransition(
  entityType: PhysicalEntityType,
  from: PhysicalState,
  to: PhysicalState,
): boolean {
  return allowedNextStates(entityType, from).includes(to);
}

export function checkTransition(
  entityType: PhysicalEntityType,
  from: PhysicalState,
  to: PhysicalState,
): TransitionCheck {
  if (canTransition(entityType, from, to)) {
    return { ok: true };
  }
  const allowed = allowedNextStates(entityType, from);
  const allowedText =
    allowed.length > 0
      ? allowed.map((state) => PHYSICAL_STATE_LABELS[state]).join(', ')
      : 'none — this item is at the end of its workflow';
  return {
    ok: false,
    reason: `${PHYSICAL_STATE_LABELS[from]} cannot move to ${PHYSICAL_STATE_LABELS[to]}. Allowed next: ${allowedText}.`,
  };
}

export function canCaseTransition(from: CaseStatus, to: CaseStatus): boolean {
  return CASE_TRANSITIONS[from].includes(to);
}

/** The state a station advances an entity to, if that entity type is handled there. */
export function stationTarget(
  entityType: PhysicalEntityType,
  station: Station,
): PhysicalState | null {
  return STATION_TARGET[station][entityType] ?? null;
}

/**
 * Infer the event a plain scan at a station should produce. Explicit events
 * (rejection, recut request) bypass this and are validated separately.
 */
export function inferScanTarget(
  entityType: PhysicalEntityType,
  station: Station,
  current: PhysicalState,
): PhysicalState | null {
  if (entityType === 'SLIDE' && station === 'MICROTOMY' && current === 'RECUT_REQUESTED') {
    return 'CUT';
  }
  const target = stationTarget(entityType, station);
  if (target && canTransition(entityType, current, target)) {
    return target;
  }
  return null;
}

export function scanNextHint(state: PhysicalState): string {
  switch (state) {
    case 'GROSSED':
      return 'Cassette confirmed at grossing. Move it to the processor.';
    case 'PROCESSING':
      return 'Processing started. Embed the cassette when the run is complete.';
    case 'EMBEDDED':
      return 'Block embedded. Cut slides at microtomy.';
    case 'CUT':
      return 'Block cut. Stain the slides and scan them at staining.';
    case 'STAINED':
      return 'Slide stained. Scan it onto the pathologist desk.';
    case 'WITH_PATHOLOGIST':
      return 'On the pathologist desk. Review and create the synoptic report.';
    case 'REPORTED':
      return 'Reported. Archive the physical item when the case is closed.';
    case 'RECUT_REQUESTED':
      return 'Recut requested. Cut a new section at microtomy and re-stain.';
    case 'REJECTED':
      return 'Rejected. Record the reason and escalate to the laboratory administrator.';
    case 'ARCHIVED':
      return 'Archived. This item is at the end of its workflow.';
    case 'ACCESSIONED':
      return 'Accessioned. Advance it at the next station.';
    default:
      return 'Scan accepted.';
  }
}
