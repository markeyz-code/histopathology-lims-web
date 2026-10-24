import type { Discipline, StateMachineDefinition, TestRequestStatus } from '@lims/shared';

export interface DisciplineRoute {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  description: string;
}

export interface WorklistConfig {
  id: string;
  discipline: Discipline;
  label: string;
  defaultStatuses: TestRequestStatus[];
  sort: Array<'priority' | 'tatDeadline' | 'receivedAt'>;
  columns: string[];
}

export interface ResultFieldDefinition {
  key: string;
  label: string;
  type: 'numeric' | 'coded' | 'text' | 'synoptic' | 'culture' | 'susceptibility';
  required?: boolean;
}

export interface DisciplineDefinition {
  id: Discipline;
  label: string;
  shortLabel: string;
  stateMachines: StateMachineDefinition[];
  worklistConfigs: WorklistConfig[];
  resultSchemas: Record<string, ResultFieldDefinition[]>;
  ruleTypes: string[];
  reportTemplates: string[];
  routes: DisciplineRoute[];
}
