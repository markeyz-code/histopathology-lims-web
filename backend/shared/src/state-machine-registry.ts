import {
  CHEMISTRY_SAMPLE_STATES,
  DISCIPLINE_LABELS,
  HAEMATOLOGY_SAMPLE_STATES,
  MICROBIOLOGY_CULTURE_STATES,
  PHYSICAL_STATE_LABELS,
  type Discipline,
  type PhysicalEntityType,
  type PhysicalState,
} from './constants';

export interface StateMachineDefinition {
  discipline: Discipline;
  entityType: string;
  label: string;
  initial: string;
  transitions: Record<string, readonly string[]>;
  labels?: Record<string, string>;
}

type TransitionTable = Partial<Record<PhysicalState, readonly PhysicalState[]>>;

export const HISTOPATHOLOGY_PHYSICAL_TRANSITIONS: Record<PhysicalEntityType, TransitionTable> = {
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

export class StateMachineRegistry {
  private readonly machines = new Map<string, StateMachineDefinition>();

  register(definition: StateMachineDefinition): void {
    this.machines.set(this.key(definition.discipline, definition.entityType), definition);
  }

  registerMany(definitions: StateMachineDefinition[]): void {
    for (const definition of definitions) this.register(definition);
  }

  has(discipline: Discipline, entityType: string): boolean {
    return this.machines.has(this.key(discipline, entityType));
  }

  get(discipline: Discipline, entityType: string): StateMachineDefinition | null {
    return this.machines.get(this.key(discipline, entityType)) ?? null;
  }

  allowed(discipline: Discipline, entityType: string, from: string): readonly string[] {
    const machine = this.get(discipline, entityType);
    if (!machine) return [];
    return machine.transitions[from] ?? [];
  }

  can(discipline: Discipline, entityType: string, from: string, to: string): boolean {
    return this.allowed(discipline, entityType, from).includes(to);
  }

  check(
    discipline: Discipline,
    entityType: string,
    from: string,
    to: string,
  ): { ok: boolean; reason?: string } {
    if (this.can(discipline, entityType, from, to)) return { ok: true };
    const machine = this.get(discipline, entityType);
    const labels = (machine?.labels ?? PHYSICAL_STATE_LABELS) as Record<string, string>;
    const fromLabel = labels[from] ?? from;
    const toLabel = labels[to] ?? to;
    const allowed = this.allowed(discipline, entityType, from);
    const allowedText =
      allowed.length > 0
        ? allowed.map((state) => labels[state] ?? state).join(', ')
        : 'none — this item is at the end of its workflow';
    return {
      ok: false,
      reason: `${fromLabel} cannot move to ${toLabel}. Allowed next: ${allowedText}.`,
    };
  }

  forDiscipline(discipline: Discipline): StateMachineDefinition[] {
    return Array.from(this.machines.values()).filter((item) => item.discipline === discipline);
  }

  list(): StateMachineDefinition[] {
    return Array.from(this.machines.values());
  }

  private key(discipline: Discipline, entityType: string): string {
    return `${discipline}:${entityType}`;
  }
}

export const stateMachineRegistry = new StateMachineRegistry();

stateMachineRegistry.registerMany([
  ...(['SPECIMEN', 'BLOCK', 'SLIDE'] as const).map((entityType) => ({
    discipline: 'HISTOPATHOLOGY' as const,
    entityType,
    label: `${DISCIPLINE_LABELS.HISTOPATHOLOGY} ${entityType.toLowerCase()}`,
    initial: 'ACCESSIONED',
    transitions: HISTOPATHOLOGY_PHYSICAL_TRANSITIONS[entityType] as Record<
      string,
      readonly string[]
    >,
    labels: PHYSICAL_STATE_LABELS as unknown as Record<string, string>,
  })),
  {
    discipline: 'HAEMATOLOGY',
    entityType: 'SAMPLE',
    label: 'Haematology sample',
    initial: 'COLLECTED',
    transitions: {
      COLLECTED: ['RECEIVED', 'REJECTED'],
      RECEIVED: ['ANALYSING', 'REJECTED'],
      ANALYSING: ['RESULTED', 'RERUN_REQUESTED', 'REJECTED'],
      RESULTED: ['VERIFIED', 'RERUN_REQUESTED'],
      VERIFIED: ['RELEASED'],
      RERUN_REQUESTED: ['ANALYSING'],
      REJECTED: ['RECEIVED'],
      RELEASED: [],
    },
    labels: Object.fromEntries(HAEMATOLOGY_SAMPLE_STATES.map((state) => [state, state])),
  },
  {
    discipline: 'CHEMICAL_PATHOLOGY',
    entityType: 'SAMPLE',
    label: 'Chemistry sample',
    initial: 'COLLECTED',
    transitions: {
      COLLECTED: ['RECEIVED', 'REJECTED'],
      RECEIVED: ['ANALYSING', 'REJECTED'],
      ANALYSING: ['RESULTED', 'RERUN_REQUESTED', 'REJECTED'],
      RESULTED: ['VERIFIED', 'RERUN_REQUESTED'],
      VERIFIED: ['RELEASED'],
      RERUN_REQUESTED: ['ANALYSING'],
      REJECTED: ['RECEIVED'],
      RELEASED: [],
    },
    labels: Object.fromEntries(CHEMISTRY_SAMPLE_STATES.map((state) => [state, state])),
  },
  {
    discipline: 'MICROBIOLOGY',
    entityType: 'CULTURE',
    label: 'Microbiology culture',
    initial: 'RECEIVED',
    transitions: {
      RECEIVED: ['PLATED', 'REJECTED'],
      PLATED: ['INCUBATING', 'REJECTED'],
      INCUBATING: ['READ', 'REJECTED'],
      READ: ['INCUBATING', 'ID_DONE', 'REPORTED'],
      ID_DONE: ['AST_DONE', 'REPORTED'],
      AST_DONE: ['REPORTED'],
      REPORTED: ['READ'],
      REJECTED: [],
    },
    labels: Object.fromEntries(MICROBIOLOGY_CULTURE_STATES.map((state) => [state, state])),
  },
]);
