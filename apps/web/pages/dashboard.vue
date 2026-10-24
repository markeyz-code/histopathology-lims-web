<script setup lang="ts">
import type { CaseStatus, DashboardSummary } from '@lims/shared';
import { CASE_STATUS_LABELS } from '@lims/shared';

definePageMeta({ title: 'Dashboard', capabilities: ['dashboard'] });
useHead({ title: 'Dashboard' });

const api = useApi();
const auth = useAuthStore();
const { number } = useFormat();

const data = ref<DashboardSummary | null>(null);
const loading = ref(true);
const refreshing = ref(false);
const error = ref<string | null>(null);
const days = ref(30);
const lastUpdated = ref<Date | null>(null);

const statusBarClass: Record<CaseStatus, string> = {
  RECEIVED: 'bg-stone-400 dark:bg-stone-500',
  IN_PROGRESS: 'bg-sky-500 dark:bg-sky-400',
  PENDING_REVIEW: 'bg-violet-500 dark:bg-violet-400',
  REPORTED: 'bg-emerald-600 dark:bg-emerald-400',
  AMENDED: 'bg-amber-500 dark:bg-amber-400',
};

async function load(background = false): Promise<void> {
  if (background) refreshing.value = true;
  else loading.value = true;
  error.value = null;
  try {
    data.value = await api.get<DashboardSummary>('/dashboard', { days: days.value });
    lastUpdated.value = new Date();
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

function setRange(value: number): void {
  if (days.value === value) return;
  days.value = value;
  void load();
}

const maxStageHours = computed(() => {
  const values = (data.value?.stageTat ?? [])
    .map((stage) => stage.averageHours ?? 0)
    .filter((value) => value > 0);
  return Math.max(1, ...values);
});

const maxWorkload = computed(() => {
  const values = (data.value?.workload ?? []).map((row) => row.activeCases);
  return Math.max(1, ...values);
});

const statusTotal = computed(() =>
  (data.value?.casesByStatus ?? []).reduce((sum, item) => sum + item.count, 0),
);

const statusAriaLabel = computed(() =>
  data.value
    ? `Cases by status: ${data.value.casesByStatus
        .map((item) => `${CASE_STATUS_LABELS[item.status]} ${item.count}`)
        .join(', ')}`
    : 'Cases by status',
);

const lastUpdatedText = computed(() =>
  lastUpdated.value
    ? `Updated ${lastUpdated.value.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : 'Live from the laboratory',
);

onMounted(() => load());
useIntervalFn(
  () => {
    if (import.meta.client && document.visibilityState === 'visible') void load(true);
  },
  60_000,
  { immediate: false },
);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Operational picture"
      title="Laboratory at a glance"
      description="Turnaround, workload and the physical workflow — measured from the accession desk to sign-out."
    >
      <template #actions>
        <div
          class="flex items-center border border-line bg-surface p-0.5"
          role="group"
          aria-label="Date range"
        >
          <button
            v-for="range in [7, 30, 90]"
            :key="range"
            type="button"
            class="px-2.5 py-1.5 font-mono text-2xs uppercase tracking-wide2 transition-colors"
            :class="days === range ? 'bg-ink text-canvas' : 'text-muted hover:text-ink'"
            @click="setRange(range)"
          >
            {{ range }}d
          </button>
        </div>
        <button type="button" class="btn btn-secondary" :disabled="refreshing" @click="load(true)">
          <AppIcon name="refresh" :size="13" :class="{ 'animate-spin': refreshing }" />
          Refresh
        </button>
        <NuxtLink v-if="auth.can('accession')" to="/accession" class="btn btn-primary">
          <AppIcon name="plus" :size="13" />
          New case
        </NuxtLink>
      </template>
      <template #meta>
        <span class="inline-flex items-center gap-1.5">
          <span class="h-1.5 w-1.5 bg-success" aria-hidden="true" />
          {{ lastUpdatedText }}
        </span>
        <span>{{ auth.lab?.name }}</span>
        <span class="mono">{{ auth.lab?.code }}</span>
      </template>
    </PageHeader>

    <ErrorState v-if="error" :message="error" @retry="load()" />

    <LoadingSkeleton v-else-if="loading" :rows="8" />

    <template v-else-if="data">
      <section aria-label="Key indicators" class="border-y border-line-strong bg-surface">
        <div class="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          <div class="p-5">
            <p class="label-caps">Active cases</p>
            <p class="stat-value mt-4">{{ number(data.totals.active) }}</p>
            <p class="mt-2 text-[11px] text-muted">
              of {{ number(data.totals.cases) }} total accessions
            </p>
          </div>
          <div class="p-5">
            <p class="label-caps">Overdue</p>
            <p
              class="stat-value mt-4"
              :class="data.totals.overdue > 0 ? 'text-danger' : 'text-ink'"
            >
              {{ number(data.totals.overdue) }}
            </p>
            <p class="mt-2 text-[11px] text-muted">
              {{ data.totals.overdue > 0 ? 'past their turnaround window' : 'no cases past TAT' }}
            </p>
          </div>
          <div class="p-5">
            <p class="label-caps">Reported · {{ days }}d</p>
            <p class="stat-value mt-4">{{ number(data.totals.reportedInRange) }}</p>
            <p class="mt-2 text-[11px] text-muted">
              {{ number(data.totals.reportedToday) }} signed today
            </p>
          </div>
          <div class="p-5">
            <p class="label-caps">Average TAT</p>
            <p class="stat-value mt-4">
              {{
                data.totals.averageTatHours === null ? '—' : number(data.totals.averageTatHours, 1)
              }}
              <span
                v-if="data.totals.averageTatHours !== null"
                class="font-mono text-sm tracking-normal text-muted"
                >h</span
              >
            </p>
            <p class="mt-2 text-[11px] text-muted">received → report signed</p>
          </div>
        </div>
      </section>

      <div class="mt-6 grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <section class="panel p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="label-caps">Case pipeline</h2>
              <p class="mt-1.5 text-sm text-muted">Where every active accession sits today.</p>
            </div>
            <span class="mono text-[10px] text-muted">{{ number(statusTotal) }} cases</span>
          </div>

          <div
            class="mt-5 flex h-3 w-full overflow-hidden bg-line/60"
            role="img"
            :aria-label="statusAriaLabel"
          >
            <span
              v-for="item in data.casesByStatus"
              :key="item.status"
              class="h-full transition-[width] duration-500"
              :class="statusBarClass[item.status as CaseStatus]"
              :style="{ width: `${statusTotal > 0 ? (item.count / statusTotal) * 100 : 0}%` }"
              :title="`${item.status}: ${item.count}`"
            />
          </div>

          <div class="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <div
              v-for="item in data.casesByStatus"
              :key="item.status"
              class="flex items-center justify-between gap-3 border-b border-line pb-2.5 last:border-b-0"
            >
              <div class="flex min-w-0 items-center gap-2.5">
                <span
                  class="h-2 w-2 shrink-0"
                  :class="statusBarClass[item.status as CaseStatus]"
                  aria-hidden="true"
                />
                <span class="font-mono text-[10px] uppercase tracking-wide2 text-muted">
                  {{ CASE_STATUS_LABELS[item.status as CaseStatus] }}
                </span>
              </div>
              <span class="mono text-sm font-medium">{{ number(item.count) }}</span>
            </div>
          </div>

          <div class="mt-6 border-t border-line pt-5">
            <h3 class="label-caps">Priority mix</h3>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="item in data.casesByPriority"
                :key="item.priority"
                class="inline-flex items-center gap-2 border border-line bg-canvas px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide2 text-muted"
              >
                <span
                  :class="
                    item.priority === 'FROZEN'
                      ? 'text-accent'
                      : item.priority === 'URGENT'
                        ? 'text-warning'
                        : 'text-muted'
                  "
                  >●</span
                >
                {{ item.priority.toLowerCase() }}
                <span class="mono text-ink">{{ item.count }}</span>
              </span>
            </div>
          </div>
        </section>

        <section class="panel p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="label-caps">Turnaround by stage</h2>
              <p class="mt-1.5 text-sm text-muted">Mean hours between workflow milestones.</p>
            </div>
            <AppIcon name="clock" :size="18" class="text-muted" />
          </div>

          <div class="mt-5 space-y-4">
            <div v-for="stage in data.stageTat" :key="stage.key">
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-xs text-ink">{{ stage.label }}</span>
                <span class="mono text-xs font-medium">
                  {{ stage.averageHours === null ? '—' : `${number(stage.averageHours, 1)}h` }}
                </span>
              </div>
              <div class="mt-1.5 h-1.5 w-full bg-line/70">
                <div
                  class="h-full bg-ink/75 transition-[width] duration-500 dark:bg-ink/90"
                  :style="{
                    width: `${stage.averageHours ? Math.max(4, (stage.averageHours / maxStageHours) * 100) : 0}%`,
                  }"
                />
              </div>
              <p class="mt-1 font-mono text-[9px] uppercase tracking-wide2 text-muted">
                {{ stage.samples }} completed ·
                {{ stage.averageHours === null ? 'no data' : 'mean' }}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div class="mt-6 grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <section class="panel">
          <div
            class="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6"
          >
            <div>
              <h2 class="label-caps text-danger">TAT breach watch</h2>
              <p class="mt-1 text-xs text-muted">Cases past their deadline, oldest first.</p>
            </div>
            <span class="mono text-sm text-danger">{{ data.alerts.length }}</span>
          </div>
          <div
            v-if="data.alerts.length === 0"
            class="px-5 py-8 text-center text-sm text-muted sm:px-6"
          >
            Every active case is inside its window.
          </div>
          <ul v-else class="divide-y divide-line">
            <li v-for="alert in data.alerts" :key="alert.caseId">
              <NuxtLink
                :to="`/cases/${alert.caseId}`"
                class="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink/[0.025] sm:px-6"
              >
                <span class="h-2 w-2 shrink-0 bg-danger" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                  <p class="mono text-[11px] text-accent">{{ alert.accessionNumber }}</p>
                  <p class="truncate text-xs text-ink">{{ alert.patientName }}</p>
                </div>
                <StatusChip :status="alert.priority" kind="priority" size="sm" />
                <span class="mono shrink-0 text-[10px] font-medium text-danger">
                  +{{ number(alert.hoursOverdue, 1) }}h
                </span>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <section class="panel p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="label-caps">Pathologist workload</h2>
              <p class="mt-1.5 text-sm text-muted">
                Active and pending-review cases per consultant.
              </p>
            </div>
            <AppIcon name="stethoscope" :size="18" class="text-muted" />
          </div>
          <div v-if="data.workload.length === 0" class="mt-6 text-sm text-muted">
            No pathologists configured.
          </div>
          <div v-else class="mt-5 space-y-5">
            <div v-for="row in data.workload" :key="row.pathologistId">
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-xs font-medium">{{ row.name }}</span>
                <span class="mono text-[11px] text-muted">
                  <span class="text-ink">{{ row.activeCases }}</span> active ·
                  <span class="text-ink">{{ row.pendingReview }}</span> review
                </span>
              </div>
              <div class="mt-1.5 h-2 w-full bg-line/70">
                <div
                  class="h-full bg-accent/80 transition-[width]"
                  :style="{
                    width: `${Math.max(row.activeCases > 0 ? 5 : 0, (row.activeCases / maxWorkload) * 100)}%`,
                  }"
                />
              </div>
              <p class="mt-1 font-mono text-[9px] uppercase tracking-wide2 text-muted">
                {{ row.reportedInRange }} signed in {{ days }} days
              </p>
            </div>
          </div>
        </section>
      </div>

      <section class="mt-8">
        <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="label-caps">Recent accessions</h2>
            <p class="mt-1 text-sm text-muted">The last eight cases received.</p>
          </div>
          <NuxtLink
            to="/cases"
            class="font-mono text-2xs uppercase tracking-caps text-accent hover:underline"
          >
            Open case register →
          </NuxtLink>
        </div>
        <div class="panel overflow-x-auto">
          <CaseTable :cases="data.recentCases" />
        </div>
      </section>
    </template>

    <EmptyState
      v-else
      icon="dashboard"
      title="No operational data yet"
      message="Accession the first case to populate the dashboard."
    >
      <NuxtLink v-if="auth.can('accession')" to="/accession" class="btn btn-primary">
        Accession a case
      </NuxtLink>
    </EmptyState>
  </div>
</template>
