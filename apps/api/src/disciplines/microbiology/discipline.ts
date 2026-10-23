import { stateMachineRegistry } from '@lims/shared';
import type { DisciplineDefinition } from '../../core/discipline/discipline-definition';

export function microbiologyDefinition(): DisciplineDefinition {
  return {
    id: 'MICROBIOLOGY',
    label: 'Medical microbiology',
    shortLabel: 'Micro',
    stateMachines: stateMachineRegistry.forDiscipline('MICROBIOLOGY'),
    worklistConfigs: [
      {
        id: 'microbiology-cultures',
        discipline: 'MICROBIOLOGY',
        label: 'Culture bench',
        defaultStatuses: ['RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW'],
        sort: ['priority', 'tatDeadline', 'receivedAt'],
        columns: ['accession', 'patient', 'specimen', 'culture', 'status'],
      },
    ],
    resultSchemas: {
      CULTURE: [{ key: 'culture', label: 'Culture and susceptibility', type: 'culture' }],
    },
    ruleTypes: [],
    reportTemplates: ['microbiology-final'],
    routes: [],
  };
}
