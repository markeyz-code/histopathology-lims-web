<script setup lang="ts">
import type {
  Discipline,
  ResultSet,
  ResultVersion,
  ResultWorklistItem,
  RuleExecution,
  TestDefinition,
} from '@lims/shared';
import { DISCIPLINE_LABELS, RESULT_FLAG_LABELS, RESULT_STATUS_LABELS } from '@lims/shared';

definePageMeta({ title: 'Results', capabilities: ['results'] });
useHead({ title: 'Result entry' });

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const { dateTime } = useFormat();

const disciplines = computed<Discipline[]>(() => {
  const enabled = auth.lab?.enabledDisciplines ?? [];
  return enabled.filter((discipline) => {
    if (discipline === 'HISTOPATHOLOGY' || discipline === 'MICROBIOLOGY') return false;
    if (auth.role === 'SUPER_ADMIN' || auth.role === 'LAB_ADMIN') return true;
    const assigned = auth.user?.disciplines?.length
      ? auth.user.disciplines
      : (['HISTOPATHOLOGY'] as Discipline[]);
    return assigned.includes(discipline);
  });
});
const discipline = ref<Discipline>('HAEMATOLOGY');
const disciplineOptions = computed(() =>
  disciplines.value.map((value) => ({ value, label: DISCIPLINE_LABELS[value] })),
);

const items = ref<ResultWorklistItem[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const selected = ref<ResultWorklistItem | null>(null);
const result = ref<ResultSet | null>(null);
const test = ref<TestDefinition | null>(null);
const values = reactive<Record<string, string>>({});
const comment = ref('');
const saving = ref(false);
const verifying = ref(false);
const acknowledging = ref(false);
const ackNote = ref('');
const ackOpen = ref(false);
const versions = ref<ResultVersion[]>([]);
const executions = ref<RuleExecution[]>([]);

const canVerify = computed(() =>
  ['SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'PATHOLOGIST'].includes(auth.role ?? ''),
);
const canRelease = computed(() =>
  ['SUPER_ADMIN', 'LAB_ADMIN', 'PATHOLOGIST'].includes(auth.role ?? ''),
);
const locked = computed(
  () => result.value?.status === 'VERIFIED' || result.value?.status === 'RELEASED',
);
const criticalUnacknowledged = computed(() =>
  Boolean(result.value?.critical && !result.value.criticalAcknowledgedAt),
);
const currentTest = computed(() => test.value ?? selected.value?.testDefinition ?? null);

watch(
  disciplines,
  (list) => {
    if (list.length > 0 && !list.includes(discipline.value)) discipline.value = list[0]!;
  },
  { immediate: true },
);

async function load(): Promise<void> {
  if (!discipline.value) return;
  loading.value = true;
  error.value = null;
  try {
    items.value = await api.get<ResultWorklistItem[]>('/results/worklist', {
      discipline: discipline.value,
    });
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function hydrate(next: ResultSet, definition: TestDefinition | null): void {
  result.value = next;
  test.value = definition;
  comment.value = next.comment ?? '';
  for (const key of Object.keys(values)) delete values[key];
  for (const value of next.values) {
    values[value.analyteKey] =
      value.value === null || value.value === undefined ? '' : String(value.value);
  }
}

async function openItem(item: ResultWorklistItem): Promise<void> {
  selected.value = item;
  test.value = item.testDefinition;
  if (item.result) {
    hydrate(item.result, item.testDefinition);
    await loadHistory(item.result.id);
    return;
  }
  if (!item.testDefinition) {
    toast.error(
      'No catalogue definition',
      `${item.testRequest.code} is not in the active catalogue.`,
    );
    return;
  }
  saving.value = true;
  try {
    const created = await api.post<ResultSet>('/results', { testRequestId: item.testRequest.id });
    hydrate(created, item.testDefinition);
    item.result = created;
    await loadHistory(created.id);
    toast.success('Draft opened', `${created.testName} · ${created.patientName}`);
  } catch (caught) {
    toast.error('Could not open result', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function loadHistory(resultId: string): Promise<void> {
  const [versionRows, executionRows] = await Promise.all([
    api.get<ResultVersion[]>(`/results/${resultId}/versions`).catch(() => []),
    api.get<RuleExecution[]>(`/results/${resultId}/executions`).catch(() => []),
  ]);
  versions.value = versionRows;
  executions.value = executionRows;
}

async function save(): Promise<void> {
  if (!result.value || !currentTest.value) return;
  saving.value = true;
  try {
    const payload = {
      values: currentTest.value.analytes.map((analyte) => {
        const raw = values[analyte.key] ?? '';
        const value =
          analyte.resultType === 'NUMERIC' || analyte.resultType === 'CALCULATED'
            ? raw === ''
              ? null
              : Number(raw)
            : raw || null;
        return { analyteKey: analyte.key, value };
      }),
      comment: comment.value.trim() || null,
    };
    const updated = await api.patch<ResultSet>(`/results/${result.value.id}`, payload);
    hydrate(updated, currentTest.value);
    if (selected.value) selected.value.result = updated;
    await loadHistory(updated.id);
    await load();
    if (updated.critical) {
      toast.error('Critical value', 'Acknowledge the critical result before verification.');
    } else if (updated.status === 'VERIFIED') {
      toast.success('Auto-verified', 'A laboratory rule verified this result.');
    } else {
      toast.success(
        updated.status === 'RESULTED' ? 'Result saved' : 'Draft saved',
        'The result version is recorded.',
      );
    }
  } catch (caught) {
    toast.error('Could not save result', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function verify(): Promise<void> {
  if (!result.value) return;
  verifying.value = true;
  try {
    const updated = await api.post<ResultSet>(`/results/${result.value.id}/verify`);
    hydrate(updated, currentTest.value);
    if (selected.value) selected.value.result = updated;
    await loadHistory(updated.id);
    await load();
    toast.success('Result verified', 'The result is ready for release.');
  } catch (caught) {
    toast.error('Verification blocked', apiErrorMessage(caught));
  } finally {
    verifying.value = false;
  }
}

async function release(): Promise<void> {
  if (!result.value) return;
  verifying.value = true;
  try {
    const updated = await api.post<ResultSet>(`/results/${result.value.id}/release`);
    hydrate(updated, currentTest.value);
    if (selected.value) selected.value.result = updated;
    await loadHistory(updated.id);
    await load();
    toast.success('Result released', 'The cumulative record is updated.');
  } catch (caught) {
    toast.error('Release blocked', apiErrorMessage(caught));
  } finally {
    verifying.value = false;
  }
}

async function acknowledge(): Promise<void> {
  if (!result.value || ackNote.value.trim().length < 3) return;
  acknowledging.value = true;
  try {
    const updated = await api.post<ResultSet>(`/results/${result.value.id}/acknowledge-critical`, {
      note: ackNote.value.trim(),
    });
    hydrate(updated, currentTest.value);
    if (selected.value) selected.value.result = updated;
    ackOpen.value = false;
    await loadHistory(updated.id);
    toast.success('Critical value acknowledged', 'The acknowledgement is recorded.');
  } catch (caught) {
    toast.error('Could not acknowledge', apiErrorMessage(caught));
  } finally {
    acknowledging.value = false;
  }
}

function flagClass(flag: string): string {
  if (flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH')
    return 'border-danger/50 bg-danger/[0.08] text-danger';
  if (flag === 'LOW' || flag === 'HIGH') return 'border-warning/50 bg-warning/[0.08] text-warning';
  if (flag === 'ABNORMAL') return 'border-warning/50 bg-warning/[0.08] text-warning';
  return 'border-line bg-canvas text-muted';
}

function statusClass(status: string): string {
  if (status === 'RELEASED') return 'text-success';
  if (status === 'VERIFIED') return 'text-success';
  if (status === 'RESULTED') return 'text-accent';
  if (status === 'CANCELLED') return 'text-danger';
  return 'text-muted';
}

onMounted(load);
watch(discipline, () => {
  selected.value = null;
  result.value = null;
  test.value = null;
  void load();
});
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Diagnostic results"
      title="Enter and verify results"
      description="Structured result entry with append-only versions, reference flags, rules and critical-value acknowledgement."
    >
      <template #actions>
        <SearchSelect
          v-model="discipline"
          :options="disciplineOptions"
          :full-width="false"
          class="w-auto min-w-[190px]"
          aria-label="Discipline"
          placeholder="Select discipline"
        />
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" :class="{ 'animate-spin': loading }" /> Refresh
        </button>
      </template>
      <template #meta>
        <span>{{ items.length }} requests</span>
        <span v-if="discipline">{{ DISCIPLINE_LABELS[discipline] }}</span>
      </template>
    </PageHeader>

    <EmptyState
      v-if="disciplines.length === 0"
      icon="beaker"
      title="No result discipline assigned"
      message="Result entry is available for haematology and chemical pathology. Ask an administrator to enable a discipline for this laboratory and assign it to your account."
    />

    <div v-else class="grid gap-5 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,2.1fr)]">
      <section class="panel h-fit">
        <div class="border-b border-line px-4 py-3">
          <p class="label-caps">Result worklist</p>
          <p class="mt-1 text-xs text-muted">Received, resulted and awaiting verification.</p>
        </div>
        <ErrorState v-if="error" :message="error" @retry="load" />
        <LoadingSkeleton v-else-if="loading" :rows="6" />
        <div v-else-if="items.length === 0" class="p-5 text-sm text-muted">
          No requests for {{ DISCIPLINE_LABELS[discipline] }}.
        </div>
        <div v-else class="divide-y divide-line">
          <button
            v-for="item in items"
            :key="item.testRequest.id"
            type="button"
            class="w-full px-4 py-3 text-left transition-colors hover:bg-raised"
            :class="selected?.testRequest.id === item.testRequest.id ? 'bg-accent/[0.06]' : ''"
            @click="openItem(item)"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="mono text-[10px] text-accent">{{ item.testRequest.accessionNumber }}</p>
                <p class="mt-0.5 truncate text-sm font-medium">
                  {{ item.testDefinition?.name ?? item.testRequest.name }}
                </p>
                <p class="mt-0.5 text-[11px] text-muted">
                  {{ item.result?.patientName ?? 'Patient' }} · {{ item.testRequest.code }}
                </p>
              </div>
              <span
                class="shrink-0 font-mono text-[9px] uppercase tracking-wide2"
                :class="statusClass(item.result?.status ?? 'DRAFT')"
              >
                {{ item.result ? RESULT_STATUS_LABELS[item.result.status] : 'Not started' }}
              </span>
            </div>
            <p
              v-if="item.result?.critical"
              class="mt-1.5 font-mono text-[9px] uppercase tracking-wide2 text-danger"
            >
              Critical value
            </p>
          </button>
        </div>
      </section>

      <section v-if="selected && currentTest && result" class="min-w-0 space-y-4">
        <div class="panel">
          <div
            class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4"
          >
            <div>
              <p class="label-caps">
                {{ currentTest.code }} · {{ DISCIPLINE_LABELS[currentTest.discipline] }}
              </p>
              <h2 class="mt-1 text-xl">{{ currentTest.name }}</h2>
              <p class="mt-1 text-xs text-muted">
                {{ result.patientName }} · {{ result.accessionNumber }} · version
                {{ result.currentVersion }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="btn btn-ghost btn-sm" :disabled="saving" @click="save">
                <AppIcon name="save" :size="12" /> {{ saving ? 'Saving…' : 'Save' }}
              </button>
              <button
                v-if="canVerify && (result.status === 'RESULTED' || result.status === 'DRAFT')"
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="verifying || criticalUnacknowledged"
                @click="verify"
              >
                <AppIcon name="check" :size="12" /> Verify
              </button>
              <button
                v-if="canRelease && result.status === 'VERIFIED'"
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="verifying"
                @click="release"
              >
                <AppIcon name="send" :size="12" /> Release
              </button>
            </div>
          </div>

          <div
            v-if="result.critical"
            class="m-5 border border-danger/40 bg-danger/[0.06] p-4 text-xs"
          >
            <p class="font-mono text-[9px] uppercase tracking-wide2 text-danger">Critical value</p>
            <p class="mt-1 text-ink">
              {{
                result.criticalAcknowledgedAt
                  ? 'Acknowledged and documented.'
                  : 'Telephone the clinician and document acknowledgement before verification.'
              }}
            </p>
            <button
              v-if="!result.criticalAcknowledgedAt"
              type="button"
              class="btn btn-secondary btn-sm mt-3"
              @click="ackOpen = true"
            >
              <AppIcon name="alert" :size="12" /> Acknowledge critical value
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Analyte</th>
                  <th>Result</th>
                  <th>Reference</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="analyte in currentTest.analytes" :key="analyte.key">
                  <td>
                    <p class="text-sm font-medium">{{ analyte.name }}</p>
                    <p class="mono text-[9px] text-muted">
                      {{ analyte.key }}<span v-if="analyte.unit"> · {{ analyte.unit }}</span>
                    </p>
                  </td>
                  <td class="min-w-[160px]">
                    <SearchSelect
                      v-if="analyte.resultType === 'CODED' && analyte.options?.length"
                      v-model="values[analyte.key]"
                      :options="analyte.options ?? []"
                      :disabled="locked"
                      placeholder="Select"
                    />
                    <input
                      v-else
                      v-model="values[analyte.key]"
                      :type="
                        analyte.resultType === 'NUMERIC' || analyte.resultType === 'CALCULATED'
                          ? 'number'
                          : 'text'
                      "
                      :step="analyte.decimals !== undefined ? 10 ** -analyte.decimals : 'any'"
                      class="input"
                      :disabled="locked || analyte.resultType === 'CALCULATED'"
                      placeholder="Result"
                    />
                  </td>
                  <td class="whitespace-nowrap text-xs text-muted">
                    <span
                      v-for="value in result.values.filter(
                        (item) => item.analyteKey === analyte.key,
                      )"
                      :key="value.analyteKey"
                    >
                      {{ value.referenceText ?? '—' }}
                    </span>
                  </td>
                  <td>
                    <span
                      v-for="value in result.values.filter(
                        (item) => item.analyteKey === analyte.key,
                      )"
                      :key="`flag-${value.analyteKey}`"
                      class="inline-flex border px-2 py-1 font-mono text-[9px] uppercase tracking-wide2"
                      :class="flagClass(value.flag)"
                    >
                      {{ RESULT_FLAG_LABELS[value.flag] }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="border-t border-line p-5">
            <FormField label="Comment" for-id="result-comment">
              <textarea
                id="result-comment"
                v-model="comment"
                class="textarea min-h-[80px]"
                :disabled="locked"
                placeholder="Interpretation, action taken or analytical note…"
              />
            </FormField>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <section class="panel p-5">
            <p class="label-caps">Version history</p>
            <ol class="mt-3 space-y-2">
              <li
                v-for="version in versions"
                :key="version.id"
                class="border-l border-line pl-3 text-xs"
              >
                <p class="mono text-[10px] text-ink">
                  v{{ version.version }} · {{ version.action.replace('_', ' ') }}
                </p>
                <p class="text-muted">
                  {{ version.createdBy?.name ?? 'System' }} · {{ dateTime(version.createdAt) }}
                </p>
                <p v-if="version.comment" class="mt-1 text-muted">{{ version.comment }}</p>
              </li>
            </ol>
          </section>
          <section class="panel p-5">
            <p class="label-caps">Rule executions</p>
            <ol class="mt-3 space-y-2">
              <li
                v-for="execution in executions"
                :key="execution.id"
                class="border-l border-line pl-3 text-xs"
              >
                <p
                  class="mono text-[10px]"
                  :class="execution.matched ? 'text-accent' : 'text-muted'"
                >
                  {{ execution.ruleCode }} · {{ execution.matched ? 'matched' : 'not matched' }}
                </p>
                <p v-if="execution.message" class="mt-1 text-muted">{{ execution.message }}</p>
              </li>
              <li v-if="executions.length === 0" class="text-xs text-muted">
                No rules have fired.
              </li>
            </ol>
          </section>
        </div>

        <div class="flex flex-wrap justify-between gap-2">
          <NuxtLink :to="`/patients/${result.patientId}/cumulative`" class="btn btn-ghost btn-sm">
            <AppIcon name="file" :size="12" /> Cumulative record
          </NuxtLink>
          <NuxtLink :to="`/cases/${result.caseId}`" class="btn btn-ghost btn-sm"
            >Open case</NuxtLink
          >
        </div>
      </section>

      <section v-else class="panel flex min-h-[320px] items-center justify-center p-8">
        <div class="max-w-sm text-center">
          <AppIcon name="beaker" :size="30" class="mx-auto text-muted" />
          <h2 class="mt-4 display text-2xl">Select a request</h2>
          <p class="mt-2 text-sm text-muted">
            Open a haematinics or chemistry request to enter results, or choose another discipline.
          </p>
        </div>
      </section>
    </div>

    <AppModal v-model="ackOpen" title="Acknowledge critical value" :persistent="acknowledging">
      <div class="space-y-4">
        <p class="text-sm leading-relaxed text-muted">
          Record who was called, when, and what action was taken. This is retained with the result
          and audit trail.
        </p>
        <FormField label="Acknowledgement note" for-id="ack-note" required>
          <textarea
            id="ack-note"
            v-model="ackNote"
            class="textarea min-h-[90px]"
            placeholder="Called Dr Adeyemi at 14:20; repeat potassium requested."
          />
        </FormField>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="acknowledging"
          @click="ackOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="acknowledging || ackNote.trim().length < 3"
          @click="acknowledge"
        >
          {{ acknowledging ? 'Saving…' : 'Acknowledge' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
