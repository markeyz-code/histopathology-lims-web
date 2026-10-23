<script setup lang="ts">
import { SUBSPECIALTIES } from '@lims/shared';

definePageMeta({ title: 'Worklist', capabilities: ['worklist'] });
useHead({ title: 'Pathologist worklist' });

const auth = useAuthStore();
const toast = useToast();
const { name, date, relative } = useFormat();
const worklist = useWorklist();

const statusOptions = [
  { value: '', label: 'All active' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'AMENDED', label: 'Amended' },
];

async function claim(caseId: string): Promise<void> {
  const detail = await worklist.claim(caseId);
  if (detail) toast.success('Case assigned to you', detail.accessionNumber);
  else toast.error('Could not claim case', worklist.error.value ?? 'Try again.');
}

function clear(): void {
  worklist.clearFilters();
}

onMounted(() => worklist.refresh());
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Pathologist desk"
      title="The work ahead"
      description="Ordered frozen → urgent → routine, then by the nearest TAT deadline. Live countdowns refresh every second."
    >
      <template #actions>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="worklist.loading.value"
          @click="worklist.refresh()"
        >
          <AppIcon name="refresh" :size="13" :class="{ 'animate-spin': worklist.loading.value }" />
          Refresh
        </button>
        <NuxtLink to="/scan/pathologist" class="btn btn-primary">
          <AppIcon name="scan" :size="13" /> Pathologist desk
        </NuxtLink>
      </template>
      <template #meta>
        <span v-if="worklist.result.value" class="mono"
          >{{ worklist.result.value.total }} cases</span
        >
        <span v-if="worklist.result.value"
          >Updated {{ relative(worklist.result.value.generatedAt) }}</span
        >
        <span>Warning at {{ auth.lab?.tatWarningPercent ?? 80 }}% of window</span>
      </template>
    </PageHeader>

    <div class="mb-4 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
      <div class="bg-surface px-4 py-3">
        <p class="label-caps">Frozen</p>
        <p class="mt-1 display text-2xl">{{ worklist.result.value?.summary.frozen ?? '—' }}</p>
      </div>
      <div class="bg-surface px-4 py-3">
        <p class="label-caps">Urgent</p>
        <p class="mt-1 display text-2xl">{{ worklist.result.value?.summary.urgent ?? '—' }}</p>
      </div>
      <div class="bg-surface px-4 py-3">
        <p class="label-caps text-danger">Overdue</p>
        <p
          class="mt-1 display text-2xl"
          :class="(worklist.result.value?.summary.overdue ?? 0) > 0 ? 'text-danger' : ''"
        >
          {{ worklist.result.value?.summary.overdue ?? '—' }}
        </p>
      </div>
      <div class="bg-surface px-4 py-3">
        <p class="label-caps">Awaiting review</p>
        <p class="mt-1 display text-2xl">
          {{ worklist.result.value?.summary.awaitingReview ?? '—' }}
        </p>
      </div>
    </div>

    <section class="panel mb-4 p-3 sm:p-4" aria-label="Worklist filters">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex border border-line bg-surface p-0.5" role="group" aria-label="Assignment">
          <button
            v-for="option in [
              { value: 'all', label: 'All' },
              { value: 'me', label: 'Mine' },
              { value: 'unassigned', label: 'Unassigned' },
            ]"
            :key="option.value"
            type="button"
            class="px-2.5 py-1.5 font-mono text-2xs uppercase tracking-wide2 transition-colors"
            :class="
              worklist.assigned.value === option.value
                ? 'bg-ink text-canvas'
                : 'text-muted hover:text-ink'
            "
            @click="worklist.assigned.value = option.value as 'all' | 'me' | 'unassigned'"
          >
            {{ option.label }}
          </button>
        </div>
        <select
          v-model="worklist.status.value"
          class="select input-sm w-auto min-w-[150px]"
          aria-label="Filter by status"
        >
          <option v-for="option in statusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
        <select
          v-model="worklist.priority.value"
          class="select input-sm w-auto"
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          <option value="FROZEN">Frozen</option>
          <option value="URGENT">Urgent</option>
          <option value="ROUTINE">Routine</option>
        </select>
        <select
          v-model="worklist.subspecialty.value"
          class="select input-sm w-auto"
          aria-label="Filter by subspecialty"
        >
          <option value="">All subspecialties</option>
          <option v-for="subspecialty in SUBSPECIALTIES" :key="subspecialty" :value="subspecialty">
            {{ subspecialty }}
          </option>
        </select>
        <button
          v-if="
            worklist.status.value ||
            worklist.priority.value ||
            worklist.subspecialty.value ||
            worklist.assigned.value !== 'all'
          "
          type="button"
          class="btn btn-ghost btn-sm"
          @click="clear"
        >
          <AppIcon name="close" :size="11" /> Clear
        </button>
      </div>
    </section>

    <ErrorState
      v-if="worklist.error.value"
      :message="worklist.error.value"
      @retry="worklist.refresh()"
    />

    <LoadingSkeleton
      v-else-if="worklist.loading.value && !worklist.result.value"
      kind="table"
      :rows="7"
    />

    <div v-else-if="worklist.result.value?.items.length === 0" class="panel">
      <EmptyState
        icon="worklist"
        title="The worklist is clear"
        message="No active cases match these filters. Frozen and urgent cases appear here as soon as they are accessioned."
        :bordered="false"
      >
        <button type="button" class="btn btn-secondary" @click="clear">Clear filters</button>
      </EmptyState>
    </div>

    <div v-else-if="worklist.result.value" class="space-y-2">
      <article
        v-for="(item, index) in worklist.result.value.items"
        :key="item.case.id"
        class="panel relative border-l-2 transition-colors hover:border-line-strong"
        :class="
          item.tat.state === 'BREACHED'
            ? 'border-l-danger'
            : item.case.priority === 'FROZEN'
              ? 'border-l-accent'
              : item.case.priority === 'URGENT'
                ? 'border-l-warning'
                : 'border-l-transparent'
        "
      >
        <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div class="flex min-w-0 flex-1 items-start gap-4">
            <span class="display w-8 shrink-0 text-2xl leading-none text-muted/70">{{
              String(index + 1).padStart(2, '0')
            }}</span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink
                  :to="`/cases/${item.case.id}`"
                  class="mono text-[11px] font-medium text-accent hover:underline"
                >
                  {{ item.case.accessionNumber }}
                </NuxtLink>
                <StatusChip :status="item.case.priority" kind="priority" size="sm" />
                <StatusChip :status="item.case.status" kind="case" size="sm" />
                <StatusChip
                  v-if="item.reportStatus"
                  :status="item.reportStatus"
                  kind="report"
                  size="sm"
                />
              </div>
              <p class="mt-1 truncate text-sm font-medium">
                {{ name(item.case.patient.firstName, item.case.patient.lastName) }}
                <span class="ml-1.5 text-xs font-normal text-muted"
                  >{{ item.case.patient.age ?? '—' }} yrs</span
                >
              </p>
              <p class="mt-0.5 text-[11px] text-muted">
                {{ item.case.subspecialty ?? 'No subspecialty' }} ·
                {{ item.pendingSlides }} awaiting review / {{ item.totalSlides }} slides ·
                {{ item.case.summary.blockCount }} blocks
              </p>
              <p class="mt-1 text-[11px] text-muted">
                <template v-if="item.case.assignedPathologist">{{
                  item.case.assignedPathologist.name
                }}</template>
                <span v-else class="text-warning">Unassigned</span>
                · received {{ date(item.case.receivedAt) }}
              </p>
            </div>
          </div>

          <div class="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end">
            <TatCountdown
              :started-at="item.tat.startedAt"
              :deadline="item.tat.deadline"
              :warning-percent="auth.lab?.tatWarningPercent ?? 80"
              :done="Boolean(item.case.report?.signedOutAt)"
              compact
            />
            <div class="flex items-center gap-1.5">
              <button
                v-if="
                  auth.role === 'PATHOLOGIST' &&
                  (!item.case.assignedPathologist ||
                    item.case.assignedPathologist.id !== auth.user?.id)
                "
                type="button"
                class="btn btn-ghost btn-sm"
                @click="claim(item.case.id)"
              >
                <AppIcon name="user" :size="11" /> Claim
              </button>
              <NuxtLink :to="`/cases/${item.case.id}`" class="btn btn-secondary btn-sm">
                Open
              </NuxtLink>
              <NuxtLink
                v-if="auth.role === 'PATHOLOGIST' || auth.role === 'SUPER_ADMIN'"
                :to="`/reports/${item.case.id}`"
                class="btn btn-primary btn-sm"
              >
                <AppIcon name="edit" :size="11" />
                {{ item.reportStatus === 'DRAFT' ? 'Continue' : 'Report' }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
