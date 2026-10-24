import { stateMachineRegistry } from '@lims/shared';
import type { DisciplineDefinition } from '../../core/discipline/discipline-definition';

export function haematologyDefinition(): DisciplineDefinition {
  return {
    id: 'HAEMATOLOGY',
    label: 'Haematology',
    shortLabel: 'Haem',
    stateMachines: stateMachineRegistry.forDiscipline('HAEMATOLOGY'),
    worklistConfigs: [
      {
        id: 'haematology-results',
        discipline: 'HAEMATOLOGY',
        label: 'Haematology results',
        defaultStatuses: ['COLLECTED', 'RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW'],
        sort: ['priority', 'tatDeadline', 'receivedAt'],
        columns: ['accession', 'patient', 'test', 'status', 'tat'],
      },
    ],
    resultSchemas: {
      FBC: [
        { key: 'haemoglobin', label: 'Haemoglobin', type: 'numeric', required: true },
        { key: 'wbc', label: 'White cell count', type: 'numeric' },
        { key: 'platelets', label: 'Platelets', type: 'numeric' },
      ],
    },
    ruleTypes: [],
    reportTemplates: ['haematology-cumulative'],
    routes: [],
  };
}
