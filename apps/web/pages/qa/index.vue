<script setup lang="ts">
import type { Paginated, QaReview, QaStats } from '@lims/shared';
import { QA_DISCREPANCY_LABELS, QA_SEVERITIES } from '@lims/shared';

definePageMeta({ title: 'QA review', capabilities: ['qa'] });
useHead({ title: 'Quality assurance' });

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const { date } = useFormat();
const reviews = ref<QaReview[]>([]);
const stats = ref<QaStats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const filter = ref<'all' | 'mine'>('all');
const selected = ref<QaReview | null>(null);
const saving = ref(false);
const outcome = ref<'AGREED' | 'DISCREPANT'>('AGREED');
const findings = ref('');
const reviewDiagnosis = ref('');
const disagreementCode = ref('NONE');
const severity = ref('MINOR');
const actionPlan = ref('');

const outcomeOptions = [
  { value: 'AGREED', label: 'Agreed' },
  { value: 'DISCREPANT', label: 'Discrepant' },
];
const discrepancyOptions = Object.entries(QA_DISCREPANCY_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const severityOptions = QA_SEVERITIES.map((value) => ({ value, label: value }));

const canAct = computed(
  () =>
    selected.value?.reviewer?.id === auth.user?.id ||
    auth.role === 'LAB_ADMIN' ||
    auth.role === 'SUPER_ADMIN',
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [list, summary] = await Promise.all([
      api.get<Paginated<QaReview>>('/qa/reviews', {
        limit: 60,
        ...(filter.value === 'mine' ? { mine: true } : {}),
      }),
      api.get<QaStats>('/qa/stats'),
    ]);
    reviews.value = list.items;
    stats.value = summary;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function openReview(review: QaReview): void {
  selected.value = review;
  outcome.value = review.status === 'DISCREPANT' ? 'DISCREPANT' : 'AGREED';
  findings.value = review.findings ?? '';
  reviewDiagnosis.value = review.reviewDiagnosis ?? '';
  disagreementCode.value = review.discrepancyCode ?? 'NONE';
  severity.value = review.severity ?? 'MINOR';
  actionPlan.value = review.actionPlan ?? '';
}

async function start(): Promise<void> {
  if (!selected.value) return;
  saving.value = true;
  try {
    selected.value = await api.post<QaReview>(`/qa/reviews/${selected.value.id}/start`, {
      findings: findings.value || undefined,
    });
    toast.success('Review started', 'The case is now in your QA queue.');
    await load();
  } catch (caught) {
    toast.error('Could not start review', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function complete(): Promise<void> {
  if (!selected.value) return;
  if (findings.value.trim().length < 10) {
    toast.error('Record findings', 'Add at least a sentence describing your review.');
    return;
  }
  saving.value = true;
  try {
    selected.value = await api.post<QaReview>(`/qa/reviews/${selected.value.id}/complete`, {
      outcome: outcome.value,
      reviewDiagnosis: reviewDiagnosis.value || undefined,
      disagreementCode: outcome.value === 'DISCREPANT' ? disagreementCode.value : undefined,
      severity: outcome.value === 'DISCREPANT' ? severity.value : undefined,
      findings: findings.value.trim(),
      actionPlan: actionPlan.value || undefined,
    });
    toast.success(
      'QA review closed',
      outcome.value === 'DISCREPANT' ? 'Discrepancy recorded for audit.' : 'Agreement recorded.',
    );
    await load();
  } catch (caught) {
    toast.error('Could not complete review', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

function statusClass(status: string): string {
  if (status === 'AGREED') return 'text-success border-success/40 bg-success/10';
  if (status === 'DISCREPANT') return 'text-danger border-danger/40 bg-danger/10';
  if (status === 'IN_REVIEW' || status === 'ASSIGNED')
    return 'text-warning border-warning/40 bg-warning/10';
  return 'text-muted border-line bg-canvas';
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Clinical governance"
      title="The second look."
      description="Peer-review sampling, requested second opinions and coded discrepancies. Every review is retained with the case."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" /> Refresh
        </button>
      </template>
      <template #meta>
        <span v-if="stats">{{ stats.samplingPercent }}% sampled</span>
        <span v-if="stats" :class="stats.overdue ? 'text-danger' : ''"
          >{{ stats.overdue }} overdue</span
        >
      </template>
    </PageHeader>

    <div v-if="stats" class="mb-5 grid grid-cols-2 border border-line bg-surface sm:grid-cols-5">
      <div class="border-b border-r border-line p-4 sm:border-b-0">
        <p class="label-caps">Pending</p>
        <p class="display mt-1 text-2xl">{{ stats.pending }}</p>
      </div>
      <div class="border-b border-line p-4 sm:border-b-0 sm:border-r">
        <p class="label-caps">In review</p>
        <p class="display mt-1 text-2xl">{{ stats.inReview }}</p>
      </div>
      <div class="border-r border-line p-4">
        <p class="label-caps">Agreed</p>
        <p class="display mt-1 text-2xl text-success">{{ stats.agreed }}</p>
      </div>
      <div class="border-r border-line p-4">
        <p class="label-caps">Discrepant</p>
        <p class="display mt-1 text-2xl text-danger">{{ stats.discrepant }}</p>
      </div>
      <div class="p-4">
        <p class="label-caps">Overdue</p>
        <p class="display mt-1 text-2xl">{{ stats.overdue }}</p>
      </div>
    </div>

    <div class="mb-4 flex gap-2">
      <button
        v-for="tab in ['all', 'mine'] as const"
        :key="tab"
        type="button"
        class="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-caps"
        :class="filter === tab ? 'border-ink bg-ink text-canvas' : 'border-line text-muted'"
        @click="
          filter = tab;
          load();
        "
      >
        {{ tab === 'all' ? 'All reviews' : 'Assigned to me' }}
      </button>
    </div>

    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="6" />
    <EmptyState
      v-else-if="reviews.length === 0"
      icon="shield"
      title="No QA reviews"
      description="Sampled peer reviews and requested second opinions appear here."
    />

    <div v-else class="divide-y divide-line border border-line bg-surface">
      <button
        v-for="review in reviews"
        :key="review.id"
        type="button"
        class="block w-full px-4 py-4 text-left hover:bg-ink/[0.025]"
        @click="openReview(review)"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="font-mono text-[10px] uppercase tracking-caps text-accent">
              {{ review.type.replace('_', ' ') }}
            </p>
            <p class="mt-1 text-sm font-medium">
              {{ review.accessionNumber }} · {{ review.patientName }}
            </p>
            <p class="mt-1 text-[11px] text-muted">
              {{ review.protocolTitle ?? 'Clinical case' }} · {{ review.reason }}
            </p>
          </div>
          <span
            class="border px-2 py-1 font-mono text-[9px] uppercase tracking-caps"
            :class="statusClass(review.status)"
            >{{ review.status.replace('_', ' ') }}</span
          >
        </div>
        <div
          class="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-caps text-muted"
        >
          <span>Reviewer {{ review.reviewer?.name ?? 'unassigned' }}</span>
          <span>Requested {{ date(review.createdAt) }}</span>
          <span
            v-if="review.dueAt"
            :class="new Date(review.dueAt) < new Date() && !review.completedAt ? 'text-danger' : ''"
            >Due {{ date(review.dueAt) }}</span
          >
          <span
            v-if="review.discrepancyCode && review.discrepancyCode !== 'NONE'"
            class="text-danger"
            >{{ QA_DISCREPANCY_LABELS[review.discrepancyCode] }}</span
          >
        </div>
      </button>
    </div>

    <AppModal
      :open="Boolean(selected)"
      title="QA review"
      :description="selected ? `${selected.accessionNumber} · ${selected.patientName}` : ''"
      @close="selected = null"
    >
      <div v-if="selected" class="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="border border-line bg-canvas p-3">
            <p class="label-caps">Original diagnosis</p>
            <p class="mt-2 text-xs leading-relaxed">{{ selected.originalDiagnosis ?? '—' }}</p>
          </div>
          <div class="border border-line bg-canvas p-3">
            <p class="label-caps">Review diagnosis</p>
            <p class="mt-2 text-xs leading-relaxed">
              {{ selected.reviewDiagnosis ?? 'Not recorded' }}
            </p>
          </div>
        </div>
        <FormField label="Findings" for-id="qa-findings">
          <textarea
            id="qa-findings"
            v-model="findings"
            class="textarea"
            rows="4"
            :disabled="!canAct"
          />
        </FormField>
        <FormField label="Review diagnosis" for-id="qa-diagnosis"
          ><input id="qa-diagnosis" v-model="reviewDiagnosis" class="input" :disabled="!canAct"
        /></FormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Outcome" for-id="qa-outcome">
            <SearchSelect
              id="qa-outcome"
              v-model="outcome"
              :options="outcomeOptions"
              :disabled="!canAct"
              placeholder="Select outcome"
            />
          </FormField>
          <FormField v-if="outcome === 'DISCREPANT'" label="Discrepancy code" for-id="qa-code">
            <SearchSelect
              id="qa-code"
              v-model="disagreementCode"
              :options="discrepancyOptions"
              :disabled="!canAct"
              placeholder="Select discrepancy"
            />
          </FormField>
        </div>
        <div v-if="outcome === 'DISCREPANT'" class="grid gap-3 sm:grid-cols-2">
          <FormField label="Severity" for-id="qa-severity">
            <SearchSelect
              id="qa-severity"
              v-model="severity"
              :options="severityOptions"
              :disabled="!canAct"
              placeholder="Select severity"
            />
          </FormField>
          <FormField label="Action plan" for-id="qa-action"
            ><input
              id="qa-action"
              v-model="actionPlan"
              class="input"
              :disabled="!canAct"
              placeholder="MDT, addendum, education…"
          /></FormField>
        </div>
        <div class="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
          <NuxtLink :to="`/cases/${selected.caseId}`" class="btn btn-ghost btn-sm"
            ><AppIcon name="cases" :size="12" /> Open case</NuxtLink
          >
          <div class="flex gap-2">
            <button
              v-if="canAct && selected.status !== 'IN_REVIEW'"
              type="button"
              class="btn btn-secondary"
              :disabled="saving"
              @click="start"
            >
              Start review
            </button>
            <button
              v-if="canAct && selected.status === 'IN_REVIEW'"
              type="button"
              class="btn btn-primary"
              :disabled="saving"
              @click="complete"
            >
              Close review
            </button>
          </div>
        </div>
        <p
          v-if="!canAct"
          class="border border-warning/30 bg-warning/[0.05] p-3 text-[11px] text-warning"
        >
          This review is assigned to another pathologist. You can read it but cannot complete it.
        </p>
      </div>
    </AppModal>
  </div>
</template>
