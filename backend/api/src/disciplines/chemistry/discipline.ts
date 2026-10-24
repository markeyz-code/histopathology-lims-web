import { stateMachineRegistry } from '@lims/shared';
import type { DisciplineDefinition } from '../../core/discipline/discipline-definition';

export function chemistryDefinition(): DisciplineDefinition {
  return {
    id: 'CHEMICAL_PATHOLOGY',
    label: 'Chemical pathology',
    shortLabel: 'Chem',
    stateMachines: stateMachineRegistry.forDiscipline('CHEMICAL_PATHOLOGY'),
    worklistConfigs: [
      {
        id: 'chemistry-results',
        discipline: 'CHEMICAL_PATHOLOGY',
        label: 'Chemistry results',
        defaultStatuses: ['COLLECTED', 'RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW'],
        sort: ['priority', 'tatDeadline', 'receivedAt'],
        columns: ['accession', 'patient', 'panel', 'status', 'tat'],
      },
    ],
    resultSchemas: {
      CHEM: [
        { key: 'sodium', label: 'Sodium', type: 'numeric' },
        { key: 'potassium', label: 'Potassium', type: 'numeric' },
        { key: 'creatinine', label: 'Creatinine', type: 'numeric' },
      ],
    },
    ruleTypes: [],
    reportTemplates: ['chemistry-cumulative'],
    routes: [],
  };
}
