import {
  DISCIPLINE_LABELS,
  DISCIPLINE_SHORT_LABELS,
  isClinicalRole,
  type Discipline,
} from '@lims/shared';

export function useDisciplines() {
  const auth = useAuthStore();

  const enabled = computed<Discipline[]>(() => auth.lab?.enabledDisciplines ?? ['HISTOPATHOLOGY']);

  const assigned = computed<Discipline[]>(() => auth.user?.disciplines ?? []);

  function canAccess(discipline: Discipline): boolean {
    if (!enabled.value.includes(discipline)) return false;
    if (!auth.role || !isClinicalRole(auth.role)) return true;
    return (assigned.value.length > 0 ? assigned.value : ['HISTOPATHOLOGY']).includes(discipline);
  }

  const available = computed(() => enabled.value.filter((discipline) => canAccess(discipline)));

  return {
    enabled,
    assigned,
    available,
    canAccess,
    labels: DISCIPLINE_LABELS,
    shortLabels: DISCIPLINE_SHORT_LABELS,
  };
}
