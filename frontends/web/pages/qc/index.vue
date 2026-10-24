<script setup lang="ts">
import type { Discipline, QcLevel, QcMaterial, QcRun, TestDefinition } from '@lims/shared';
import { DISCIPLINE_LABELS, QC_LEVELS, WESTGARD_RULE_LABELS } from '@lims/shared';

definePageMeta({ title: 'Quality control', capabilities: ['qc'] });
useHead({ title: 'Quality control' });

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const { dateTime } = useFormat();

const disciplines = computed<Discipline[]>(() => {
  const enabled = auth.lab?.enabledDisciplines ?? [];
  return enabled.filter((discipline) => {
    if (discipline !== 'HAEMATOLOGY' && discipline !== 'CHEMICAL_PATHOLOGY') return false;
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

const materials = ref<QcMaterial[]>([]);
const runs = ref<QcRun[]>([]);
const tests = ref<TestDefinition[]>([]);
const selectedMaterial = ref<QcMaterial | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const materialOpen = ref(false);
const runOpen = ref(false);
const materialForm = reactive({
  name: '',
  lotNumber: '',
  level: 'NORMAL' as QcLevel,
  testCode: '',
  analyteKey: '',
  targetMean: 0,
  targetSd: 1,
  unit: '',
});
const runValues = ref<string[]>(['', '', '']);
const runComment = ref('');

const testOptions = computed(() =>
  tests.value.map((test) => ({
    value: test.code,
    label: `${test.code} · ${test.name}`,
    description: `${test.analytes.length} analytes`,
  })),
);
const analyteOptions = computed(() => {
  const test = tests.value.find((item) => item.code === materialForm.testCode);
  return (test?.analytes ?? []).map((analyte) => ({
    value: analyte.key,
    label: `${analyte.name}${analyte.unit ? ` · ${analyte.unit}` : ''}`,
  }));
});
const levelOptions = QC_LEVELS.map((value) => ({ value, label: value }));
const selectedRuns = computed(() =>
  selectedMaterial.value
    ? runs.value.filter((run) => run.materialId === selectedMaterial.value?.id)
    : [],
);
const chartRuns = computed(() => [...selectedRuns.value].reverse());
const chartPoints = computed(() => {
  const all = chartRuns.value.flatMap((run) => run.points);
  const mean = selectedMaterial.value?.targetMean ?? 0;
  const sd = selectedMaterial.value?.targetSd ?? 1;
  const low = mean - 4 * sd;
  const high = mean + 4 * sd;
  const width = 680;
  const height = 220;
  const pad = 34;
  return all.map((point, index) => ({
    x: pad + (index * (width - pad * 2)) / Math.max(all.length - 1, 1),
    y: pad + ((high - point.value) / (high - low)) * (height - pad * 2),
    value: point.value,
    z: point.z,
  }));
});
const meanLine = computed(() => {
  const mean = selectedMaterial.value?.targetMean ?? 0;
  const sd = selectedMaterial.value?.targetSd ?? 1;
  return [3, 2, 1, 0, -1, -2, -3].map((step) => ({ step, value: mean + step * sd }));
});
function yFor(value: number): number {
  const mean = selectedMaterial.value?.targetMean ?? 0;
  const sd = selectedMaterial.value?.targetSd ?? 1;
  const low = mean - 4 * sd;
  const high = mean + 4 * sd;
  return 34 + ((high - value) / (high - low)) * 152;
}

async function load(): Promise<void> {
  if (!discipline.value) return;
  loading.value = true;
  error.value = null;
  try {
    const [materialRows, testPage] = await Promise.all([
      api.get<QcMaterial[]>('/qc/materials', { discipline: discipline.value }),
      api.get<{ items: TestDefinition[] }>('/catalog/tests', {
        discipline: discipline.value,
        limit: 100,
      }),
    ]);
    materials.value = materialRows;
    tests.value = testPage.items;
    if (!selectedMaterial.value || selectedMaterial.value.discipline !== discipline.value) {
      selectedMaterial.value = materialRows[0] ?? null;
    }
    await loadRuns();
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function loadRuns(): Promise<void> {
  const params: Record<string, string | number> = { limit: 100 };
  if (discipline.value) params.discipline = discipline.value;
  runs.value = (await api.get<{ items: QcRun[] }>('/qc/runs', params)).items;
}

function openMaterial(): void {
  materialForm.name = '';
  materialForm.lotNumber = `QC-${Date.now().toString().slice(-6)}`;
  materialForm.level = 'NORMAL';
  materialForm.testCode = tests.value[0]?.code ?? '';
  materialForm.analyteKey = tests.value[0]?.analytes[0]?.key ?? '';
  materialForm.targetMean = 0;
  materialForm.targetSd = 1;
  materialForm.unit = tests.value[0]?.analytes[0]?.unit ?? '';
  materialOpen.value = true;
}

async function createMaterial(): Promise<void> {
  saving.value = true;
  try {
    await api.post('/qc/materials', {
      ...materialForm,
      discipline: discipline.value,
      unit: materialForm.unit || null,
    });
    materialOpen.value = false;
    toast.success('QC material added', materialForm.lotNumber);
    await load();
  } catch (caught) {
    toast.error('Could not add material', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

function openRun(): void {
  if (!selectedMaterial.value) return;
  runValues.value = ['', '', ''];
  runComment.value = '';
  runOpen.value = true;
}

async function createRun(): Promise<void> {
  if (!selectedMaterial.value) return;
  const values = runValues.value
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (values.length < 2) {
    toast.error('At least two points', 'Enter at least two control results.');
    return;
  }
  saving.value = true;
  try {
    await api.post('/qc/runs', {
      materialId: selectedMaterial.value.id,
      values,
      comment: runComment.value.trim() || null,
    });
    runOpen.value = false;
    toast.success('QC run recorded', 'The Levey-Jennings chart and Westgard rules were evaluated.');
    await loadRuns();
  } catch (caught) {
    toast.error('Could not save QC run', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

function addPoint(): void {
  if (runValues.value.length < 10) runValues.value.push('');
}

function selectMaterial(material: QcMaterial): void {
  selectedMaterial.value = material;
}

watch(
  disciplines,
  (list) => {
    if (list.length > 0 && !list.includes(discipline.value)) discipline.value = list[0]!;
  },
  { immediate: true },
);

onMounted(load);
watch(discipline, () => {
  selectedMaterial.value = null;
  void load();
});
watch(
  () => materialForm.testCode,
  () => {
    const test = tests.value.find((item) => item.code === materialForm.testCode);
    materialForm.analyteKey = test?.analytes[0]?.key ?? '';
    materialForm.unit = test?.analytes[0]?.unit ?? '';
  },
);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Quality management"
      title="Quality control"
      description="Levey-Jennings charts, Westgard rules and lot-level QC materials for haematology and chemistry."
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
      <template #meta
        ><span>{{ materials.length }} materials</span><span>{{ runs.length }} runs</span></template
      >
    </PageHeader>

    <EmptyState
      v-if="disciplines.length === 0"
      icon="shield"
      title="No QC discipline assigned"
      message="Quality control is available for haematology and chemical pathology. Ask an administrator to assign the discipline."
    />

    <ErrorState v-else-if="error" :message="error" @retry="load" />

    <div v-else class="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
      <div class="space-y-4">
        <section class="panel">
          <div class="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p class="label-caps">Levey-Jennings</p>
              <p class="mt-1 text-xs text-muted">
                {{
                  selectedMaterial
                    ? `${selectedMaterial.name} · ${selectedMaterial.lotNumber}`
                    : 'Select a QC material'
                }}
              </p>
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="!selectedMaterial"
              @click="openRun"
            >
              <AppIcon name="plus" :size="12" /> Record run
            </button>
          </div>
          <div v-if="!selectedMaterial" class="p-8 text-sm text-muted">
            No QC material configured for this discipline.
          </div>
          <div v-else class="p-4">
            <div class="overflow-x-auto border border-line bg-canvas p-2">
              <svg
                viewBox="0 0 680 220"
                class="h-[220px] w-full min-w-0 sm:min-w-[560px]"
                role="img"
                aria-label="Levey-Jennings chart"
              >
                <line
                  v-for="line in meanLine"
                  :key="line.step"
                  x1="34"
                  :y1="yFor(line.value)"
                  x2="646"
                  :y2="yFor(line.value)"
                  :stroke="
                    line.step === 0
                      ? '#68706B'
                      : line.step === 3 || line.step === -3
                        ? '#B8391D'
                        : '#D8D3C7'
                  "
                  :stroke-width="line.step === 0 ? 1.4 : 0.8"
                  :stroke-dasharray="line.step === 0 ? '' : '4 4'"
                />
                <text
                  x="36"
                  :y="yFor(meanLine[0]!.value) - 4"
                  class="fill-current font-mono text-[8px] text-muted"
                >
                  +3 SD
                </text>
                <text
                  x="36"
                  :y="yFor(meanLine[3]!.value) - 4"
                  class="fill-current font-mono text-[8px] text-muted"
                >
                  Mean
                </text>
                <text
                  x="36"
                  :y="yFor(meanLine[6]!.value) + 10"
                  class="fill-current font-mono text-[8px] text-muted"
                >
                  −3 SD
                </text>
                <polyline
                  v-if="chartPoints.length > 1"
                  :points="chartPoints.map((point) => `${point.x},${point.y}`).join(' ')"
                  fill="none"
                  stroke="#B8391D"
                  stroke-width="2"
                />
                <circle
                  v-for="(point, index) in chartPoints"
                  :key="`${point.x}-${index}`"
                  :cx="point.x"
                  :cy="point.y"
                  r="3.2"
                  :fill="Math.abs(point.z) > 2 ? '#B8391D' : '#1A1D1F'"
                />
              </svg>
            </div>
            <div class="mt-3 flex flex-wrap gap-3 text-[10px] text-muted">
              <span class="font-mono"
                >Mean {{ selectedMaterial.targetMean }} {{ selectedMaterial.unit }}</span
              >
              <span class="font-mono">SD {{ selectedMaterial.targetSd }}</span>
              <span class="font-mono">{{ selectedRuns.length }} runs</span>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <p class="label-caps">QC runs</p>
              <p class="mt-1 text-xs text-muted">Westgard violations are evaluated on every run.</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" @click="openMaterial">
              <AppIcon name="plus" :size="12" /> Material
            </button>
          </div>
          <LoadingSkeleton v-if="loading" :rows="4" />
          <div v-else-if="selectedRuns.length === 0" class="p-6 text-sm text-muted">
            No QC runs recorded for this material.
          </div>
          <div v-else class="divide-y divide-line">
            <article v-for="run in selectedRuns" :key="run.id" class="px-5 py-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p class="mono text-[10px] text-muted">
                    {{ dateTime(run.createdAt) }} · {{ run.performedBy?.name ?? 'Scientist' }}
                  </p>
                  <p class="mt-0.5 font-mono text-xs">
                    {{ run.values.join(' · ') }} {{ selectedMaterial?.unit }}
                  </p>
                </div>
                <span
                  class="font-mono text-[9px] uppercase tracking-wide2"
                  :class="
                    run.status === 'REJECTED'
                      ? 'text-danger'
                      : run.status === 'WARNING'
                        ? 'text-warning'
                        : 'text-success'
                  "
                >
                  {{ run.status }}
                </span>
              </div>
              <ul v-if="run.violations.length" class="mt-2 space-y-1">
                <li
                  v-for="violation in run.violations"
                  :key="violation.rule"
                  class="text-[11px] text-danger"
                >
                  <span class="font-mono text-[9px]">{{ violation.rule }}</span> ·
                  {{ WESTGARD_RULE_LABELS[violation.rule] }}
                </li>
              </ul>
              <p v-else class="mt-1 text-[11px] text-success">All Westgard rules passed.</p>
            </article>
          </div>
        </section>
      </div>

      <aside class="space-y-4">
        <section class="panel">
          <div class="border-b border-line px-4 py-3">
            <p class="label-caps">QC materials</p>
            <p class="mt-1 text-xs text-muted">Select a material to chart its runs.</p>
          </div>
          <div class="divide-y divide-line">
            <button
              v-for="material in materials"
              :key="material.id"
              type="button"
              class="w-full px-4 py-3 text-left hover:bg-raised"
              :class="selectedMaterial?.id === material.id ? 'bg-accent/[0.06]' : ''"
              @click="selectMaterial(material)"
            >
              <p class="text-sm font-medium">{{ material.name }}</p>
              <p class="mono mt-0.5 text-[9px] text-muted">
                {{ material.lotNumber }} · {{ material.level }} · {{ material.testCode }}/{{
                  material.analyteKey
                }}
              </p>
              <p class="mt-1 text-[10px] text-muted">
                Target {{ material.targetMean }} {{ material.unit }} · SD {{ material.targetSd }}
              </p>
            </button>
            <p v-if="materials.length === 0" class="p-4 text-xs text-muted">No materials yet.</p>
          </div>
        </section>
      </aside>
    </div>

    <AppModal v-model="materialOpen" title="Add QC material" :persistent="saving">
      <div class="grid gap-3 sm:grid-cols-2">
        <FormField label="Name" for-id="qc-name" required
          ><input id="qc-name" v-model="materialForm.name" class="input"
        /></FormField>
        <FormField label="Lot number" for-id="qc-lot" required
          ><input id="qc-lot" v-model="materialForm.lotNumber" class="input font-mono"
        /></FormField>
        <FormField label="Level" for-id="qc-level"
          ><SearchSelect id="qc-level" v-model="materialForm.level" :options="levelOptions"
        /></FormField>
        <FormField label="Test" for-id="qc-test"
          ><SearchSelect id="qc-test" v-model="materialForm.testCode" :options="testOptions"
        /></FormField>
        <FormField label="Analyte" for-id="qc-analyte"
          ><SearchSelect
            id="qc-analyte"
            v-model="materialForm.analyteKey"
            :options="analyteOptions"
        /></FormField>
        <FormField label="Unit" for-id="qc-unit"
          ><input id="qc-unit" v-model="materialForm.unit" class="input"
        /></FormField>
        <FormField label="Target mean" for-id="qc-mean"
          ><input
            id="qc-mean"
            v-model.number="materialForm.targetMean"
            type="number"
            step="0.01"
            class="input"
        /></FormField>
        <FormField label="Target SD" for-id="qc-sd"
          ><input
            id="qc-sd"
            v-model.number="materialForm.targetSd"
            type="number"
            step="0.01"
            min="0.01"
            class="input"
        /></FormField>
      </div>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="materialOpen = false">Cancel</button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="createMaterial">
          Add material
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="runOpen"
      title="Record QC run"
      :description="selectedMaterial?.name"
      :persistent="saving"
    >
      <div class="space-y-4">
        <div class="grid gap-2 sm:grid-cols-3">
          <FormField
            v-for="(_, index) in runValues"
            :key="index"
            :label="`Point ${index + 1}`"
            :for-id="`qc-point-${index}`"
          >
            <input
              :id="`qc-point-${index}`"
              v-model="runValues[index]"
              type="number"
              step="any"
              class="input"
            />
          </FormField>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          :disabled="runValues.length >= 10"
          @click="addPoint"
        >
          <AppIcon name="plus" :size="11" /> Add point
        </button>
        <FormField label="Comment" for-id="qc-comment">
          <textarea id="qc-comment" v-model="runComment" class="textarea min-h-[70px]" />
        </FormField>
      </div>
      <template #footer>
        <button type="button" class="btn btn-ghost" @click="runOpen = false">Cancel</button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="createRun">
          Save run
        </button>
      </template>
    </AppModal>
  </div>
</template>
