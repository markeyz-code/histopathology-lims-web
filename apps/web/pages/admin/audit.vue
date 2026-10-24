<script setup lang="ts">
import type { AuditLog, Paginated } from '@lims/shared';
import { AUDIT_ACTIONS } from '@lims/shared';

definePageMeta({ title: 'Audit log', capabilities: ['audit'] });
useHead({ title: 'Audit log' });

const api = useApi();
const { dateTime, relative } = useFormat();

const logs = ref<AuditLog[]>([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(true);
const error = ref<string | null>(null);

const action = ref('');
const entityType = ref('');
const from = ref('');
const to = ref('');

const selected = ref<AuditLog | null>(null);
const detailOpen = ref(false);

const entityOptions = [
  'Case',
  'Report',
  'Specimen',
  'Block',
  'Slide',
  'User',
  'Lab',
  'Protocol',
  'CustodyEvent',
];
const actionOptions = [
  { value: '', label: 'All actions' },
  ...AUDIT_ACTIONS.map((value) => ({ value, label: value.replace('_', ' ') })),
];
const entitySelectOptions = [
  { value: '', label: 'All entities' },
  ...entityOptions.map((value) => ({ value, label: value })),
];

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const params: Record<string, string | number> = { page: page.value, limit: 30 };
    if (action.value) params.action = action.value;
    if (entityType.value) params.entityType = entityType.value;
    if (from.value) params.from = from.value;
    if (to.value) params.to = to.value;
    const result = await api.get<Paginated<AuditLog>>('/audit', params);
    logs.value = result.items;
    total.value = result.total;
    totalPages.value = result.totalPages;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

watch([action, entityType, from, to], () => {
  page.value = 1;
  void load();
});
watch(page, () => load());

function openDetail(log: AuditLog): void {
  selected.value = log;
  detailOpen.value = true;
}

function pretty(value: Record<string, unknown> | null): string {
  return value ? JSON.stringify(value, null, 2) : '—';
}

function actionClass(actionValue: string): string {
  if (actionValue === 'SIGN_OUT') return 'text-success border-success/40 bg-success/10';
  if (actionValue === 'AMEND') return 'text-warning border-warning/40 bg-warning/10';
  if (actionValue === 'SCAN') return 'text-accent border-accent/40 bg-accent/10';
  if (actionValue === 'CREATE') return 'text-ink border-line bg-canvas';
  if (actionValue === 'DELETE') return 'text-danger border-danger/40 bg-danger/10';
  return 'text-muted border-line bg-canvas';
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="Audit log"
      description="Append-only records of every create, update, scan, sign-out and amendment, with before and after values."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" /> Refresh
        </button>
      </template>
      <template #meta>
        <span class="mono">{{ total }} records</span>
        <span>Immutable collection</span>
      </template>
    </PageHeader>

    <AdminNav />

    <div class="panel mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-5 sm:p-4">
      <SearchSelect
        v-model="action"
        :options="actionOptions"
        aria-label="Filter by action"
        placeholder="All actions"
      />
      <SearchSelect
        v-model="entityType"
        :options="entitySelectOptions"
        aria-label="Filter by entity"
        placeholder="All entities"
      />
      <label class="flex items-center gap-2 border border-line bg-raised px-2.5">
        <span class="font-mono text-[9px] uppercase tracking-wide2 text-muted">From</span>
        <input
          v-model="from"
          type="date"
          class="input-sm w-full border-0 bg-transparent px-0 focus:ring-0"
        />
      </label>
      <label class="flex items-center gap-2 border border-line bg-raised px-2.5">
        <span class="font-mono text-[9px] uppercase tracking-wide2 text-muted">To</span>
        <input
          v-model="to"
          type="date"
          class="input-sm w-full border-0 bg-transparent px-0 focus:ring-0"
        />
      </label>
      <button
        type="button"
        class="btn btn-ghost"
        @click="
          action = '';
          entityType = '';
          from = '';
          to = '';
        "
      >
        Clear
      </button>
    </div>

    <ErrorState v-if="error" :message="error" @retry="load" />

    <div v-else class="panel">
      <LoadingSkeleton v-if="loading" kind="table" :rows="8" />
      <EmptyState
        v-else-if="logs.length === 0"
        icon="audit"
        title="No audit records"
        message="No entries match these filters."
        :bordered="false"
      />
      <div v-else class="overflow-x-auto">
        <table class="data-table mobile-cards">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Action</th>
              <th scope="col">Entity</th>
              <th scope="col">Actor</th>
              <th scope="col">Case</th>
              <th scope="col">Request</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id" class="cursor-pointer" @click="openDetail(log)">
              <td data-label="Time" class="whitespace-nowrap font-mono text-[10px]" :title="dateTime(log.createdAt)">
                {{ dateTime(log.createdAt) }}
                <span class="block text-[9px] text-muted">{{ relative(log.createdAt) }}</span>
              </td>
              <td data-label="Action">
                <span
                  class="inline-flex border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide2"
                  :class="actionClass(log.action)"
                >
                  {{ log.action.replace('_', ' ') }}
                </span>
              </td>
              <td data-label="Entity" class="text-xs">
                <span class="font-medium">{{ log.entityType }}</span>
                <span class="mono block text-[9px] text-muted">{{ log.entityId ?? '—' }}</span>
              </td>
              <td data-label="Actor" class="text-xs">
                {{ log.userName }}
                <span class="block font-mono text-[9px] text-muted">{{ log.userRole ?? '—' }}</span>
              </td>
              <td data-label="Case" class="mono text-[10px] text-muted">{{ log.caseId ?? '—' }}</td>
              <td data-label="Request" class="mono text-[9px] text-muted">{{ log.requestId ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="logs.length > 0"
        class="flex items-center justify-between border-t border-line px-4 py-3"
      >
        <p class="font-mono text-[10px] uppercase tracking-wide2 text-muted">
          Page {{ page }} of {{ totalPages }} · {{ total }} records
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="page <= 1"
            @click="page -= 1"
          >
            Previous
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="page >= totalPages"
            @click="page += 1"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <AppModal
      v-model="detailOpen"
      title="Audit record"
      :description="selected ? `${selected.action} · ${selected.entityType}` : ''"
      size="lg"
    >
      <div v-if="selected" class="space-y-4">
        <dl class="grid gap-3 border border-line bg-canvas p-4 text-xs sm:grid-cols-2">
          <div>
            <dt class="label-caps">Time</dt>
            <dd class="mono mt-1">{{ dateTime(selected.createdAt) }}</dd>
          </div>
          <div>
            <dt class="label-caps">Actor</dt>
            <dd class="mt-1">
              {{ selected.userName }} <span class="text-muted">· {{ selected.userRole }}</span>
            </dd>
          </div>
          <div>
            <dt class="label-caps">Entity</dt>
            <dd class="mono mt-1">{{ selected.entityType }} / {{ selected.entityId ?? '—' }}</dd>
          </div>
          <div>
            <dt class="label-caps">Case</dt>
            <dd class="mono mt-1">{{ selected.caseId ?? '—' }}</dd>
          </div>
          <div>
            <dt class="label-caps">Request ID</dt>
            <dd class="mono mt-1">{{ selected.requestId ?? '—' }}</dd>
          </div>
          <div>
            <dt class="label-caps">IP</dt>
            <dd class="mono mt-1">{{ selected.ip ?? '—' }}</dd>
          </div>
        </dl>
        <div class="grid gap-4 lg:grid-cols-2">
          <div>
            <p class="label-caps mb-2">Before</p>
            <pre
              class="max-h-[300px] overflow-auto border border-line bg-canvas p-3 font-mono text-[10px] leading-relaxed text-muted"
              >{{ pretty(selected.before) }}</pre>
          </div>
          <div>
            <p class="label-caps mb-2">After</p>
            <pre
              class="max-h-[300px] overflow-auto border border-line bg-canvas p-3 font-mono text-[10px] leading-relaxed text-ink"
              >{{ pretty(selected.after) }}</pre>
          </div>
        </div>
      </div>
      <template #footer>
        <button type="button" class="btn btn-secondary" @click="detailOpen = false">Close</button>
      </template>
    </AppModal>
  </div>
</template>
