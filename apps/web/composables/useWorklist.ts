import type { CaseDetail, WorklistResult } from '@lims/shared';
import { useDebounceFn } from '@vueuse/core';

export function useWorklist() {
  const api = useApi();
  const status = ref<string>('');
  const priority = ref<string>('');
  const assigned = ref<'all' | 'me' | 'unassigned'>('all');
  const subspecialty = ref('');
  const result = ref<WorklistResult | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    try {
      const query: Record<string, string> = { assigned: assigned.value, limit: '60' };
      if (status.value) query.status = status.value;
      if (priority.value) query.priority = priority.value;
      if (subspecialty.value) query.subspecialty = subspecialty.value;
      result.value = await api.get<WorklistResult>('/worklist', query);
    } catch (caught) {
      error.value = apiErrorMessage(caught);
    } finally {
      loading.value = false;
    }
  }

  const debouncedRefresh = useDebounceFn(refresh, 220);

  watch([status, priority, assigned, subspecialty], () => {
    void debouncedRefresh();
  });

  async function claim(caseId: string): Promise<CaseDetail | null> {
    try {
      const detail = await api.post<CaseDetail>(`/worklist/${caseId}/claim`);
      await refresh();
      return detail;
    } catch (caught) {
      error.value = apiErrorMessage(caught);
      return null;
    }
  }

  function clearFilters(): void {
    status.value = '';
    priority.value = '';
    assigned.value = 'all';
    subspecialty.value = '';
  }

  useIntervalFn(
    () => {
      if (import.meta.client && document.visibilityState === 'visible') void refresh();
    },
    30_000,
    { immediate: false },
  );

  return {
    status,
    priority,
    assigned,
    subspecialty,
    result,
    loading,
    error,
    refresh,
    claim,
    clearFilters,
  };
}
