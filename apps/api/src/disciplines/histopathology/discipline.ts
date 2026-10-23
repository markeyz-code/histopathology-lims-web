import { stateMachineRegistry, type StateMachineDefinition } from '@lims/shared';
import type { DisciplineDefinition } from '../../core/discipline/discipline-definition';

export function histopathologyDefinition(): DisciplineDefinition {
  return {
    id: 'HISTOPATHOLOGY',
    label: 'Histopathology',
    shortLabel: 'Histo',
    stateMachines: stateMachineRegistry.forDiscipline('HISTOPATHOLOGY') as StateMachineDefinition[],
    worklistConfigs: [
      {
        id: 'histopathology-pathologist',
        discipline: 'HISTOPATHOLOGY',
        label: 'Pathologist worklist',
        defaultStatuses: ['RECEIVED', 'IN_PROGRESS', 'PENDING_REVIEW'],
        sort: ['priority', 'tatDeadline', 'receivedAt'],
        columns: ['accession', 'patient', 'priority', 'slides', 'tat'],
      },
    ],
    resultSchemas: {
      SYNOPTIC: [
        { key: 'specimen', label: 'Specimen', type: 'synoptic', required: true },
        { key: 'diagnosis', label: 'Diagnosis', type: 'synoptic', required: true },
      ],
    },
    ruleTypes: [],
    reportTemplates: ['histopathology-synoptic'],
    routes: [
      { method: 'GET', path: '/api/cases', description: 'Case and specimen tracking' },
      { method: 'POST', path: '/api/custody/scan', description: 'Histopathology custody scan' },
      { method: 'GET', path: '/api/worklist', description: 'Pathologist worklist' },
      { method: 'GET', path: '/api/reports/:caseId', description: 'Synoptic report' },
    ],
  };
}
