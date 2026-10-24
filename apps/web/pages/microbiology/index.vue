<script setup lang="ts">
import type {
  Antibiotic,
  AntibiogramRow,
  Culture,
  Isolate,
  Organism,
  Paginated,
  SusceptibilityResult,
  TestRequest,
} from '@lims/shared';
import { AST_INTERPRETATION_LABELS, MICROBIOLOGY_CULTURE_STATUS_LABELS } from '@lims/shared';

definePageMeta({ title: 'Microbiology', capabilities: ['microbiology'] });
useHead({ title: 'Microbiology' });

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const documents = useDocuments();
const cultures = ref<Culture[]>([]);
const requests = ref<TestRequest[]>([]);
const organisms = ref<Organism[]>([]);
const antibiotics = ref<Antibiotic[]>([]);
const antibiogram = ref<AntibiogramRow[]>([]);
const selected = ref<
  (Culture & { isolates: Isolate[]; susceptibilities: SusceptibilityResult[] }) | null
>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const createOpen = ref(false);
const createRequest = ref('');
const createSpecimen = ref('Midstream urine');
const createPlate = ref('CLED + blood agar');
const isolateOrganism = ref('');
const astAntibiotic = ref('');
const astMethod = ref<'MIC' | 'DISK'>('MIC');
const astValue = ref('');
const selectedCultureId = ref('');

const canCreate = computed(() =>
  ['SUPER_ADMIN', 'LAB_ADMIN', 'SCIENTIST', 'TECHNOLOGIST'].includes(auth.role ?? ''),
);
const requestOptions = computed(() =>
  requests.value.map((request) => ({
    value: request.id,
    label: `${request.accessionNumber} · ${request.name}`,
  })),
);
const organismOptions = computed(() =>
  organisms.value.map((organism) => ({
    value: organism.code,
    label: organism.name,
    description: organism.gram,
  })),
);
const antibioticOptions = computed(() =>
  antibiotics.value.map((antibiotic) => ({
    value: antibiotic.code,
    label: antibiotic.name,
    description: antibiotic.className,
  })),
);
const statusOptions = computed(() => {
  if (!selected.value) return [];
  const current = selected.value.status;
  const next: Record<string, string[]> = {
    RECEIVED: ['PLATED', 'REJECTED'],
    PLATED: ['INCUBATING', 'REJECTED'],
    INCUBATING: ['READ', 'REJECTED'],
    READ: ['ID_DONE', 'REPORTED', 'REJECTED'],
    ID_DONE: ['AST_DONE', 'REPORTED'],
    AST_DONE: ['REPORTED'],
    REPORTED: ['READ'],
    REJECTED: [],
  };
  return (next[current] ?? []).map((value) => ({
    value,
    label: MICROBIOLOGY_CULTURE_STATUS_LABELS[value] ?? value,
  }));
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [cultureRows, requestPage, organismRows, antibioticRows, abg] = await Promise.all([
      api.get<Culture[]>('/micro/cultures'),
      api.get<Paginated<TestRequest>>('/test-requests', {
        discipline: 'MICROBIOLOGY',
        status: 'RECEIVED',
        limit: 100,
      }),
      api.get<Organism[]>('/micro/organisms'),
      api.get<Antibiotic[]>('/micro/antibiotics'),
      api.get<AntibiogramRow[]>('/micro/antibiogram'),
    ]);
    cultures.value = cultureRows;
    requests.value = requestPage.items;
    organisms.value = organismRows;
    antibiotics.value = antibioticRows;
    antibiogram.value = abg;
    if (!selectedCultureId.value && cultureRows[0]) await openCulture(cultureRows[0]);
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function openCulture(culture: Culture): Promise<void> {
  selectedCultureId.value = culture.id;
  try {
    const loaded = await api.get<
      Culture & { isolates: Isolate[]; susceptibilities: SusceptibilityResult[] }
    >(`/micro/cultures/${culture.id}`);
    selected.value = loaded;
    isolateOrganism.value = loaded.isolates[0]?.organismCode ?? '';
    astAntibiotic.value = antibiotics.value[0]?.code ?? '';
    astValue.value = '';
  } catch (caught) {
    toast.error('Could not load culture', apiErrorMessage(caught));
  }
}

async function createCulture(): Promise<void> {
  if (!createRequest.value) return;
  saving.value = true;
  try {
    await api.post('/micro/cultures', {
      testRequestId: createRequest.value,
      specimenType: createSpecimen.value,
      plateType: createPlate.value,
      media: 'CLED',
    });
    createOpen.value = false;
    toast.success('Culture created', 'Plate the specimen and begin incubation.');
    await load();
  } catch (caught) {
    toast.error('Could not create culture', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function setStatus(status: string): Promise<void> {
  if (!selected.value) return;
  saving.value = true;
  try {
    const updated = await api.patch<Culture>(`/micro/cultures/${selected.value.id}`, { status });
    selected.value = { ...selected.value, ...updated };
    toast.success('Culture updated', MICROBIOLOGY_CULTURE_STATUS_LABELS[status] ?? status);
    await load();
  } catch (caught) {
    toast.error('Transition blocked', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function addIsolate(): Promise<void> {
  if (!selected.value || !isolateOrganism.value) return;
  saving.value = true;
  try {
    await api.post(`/micro/cultures/${selected.value.id}/isolates`, {
      organismCode: isolateOrganism.value,
    });
    toast.success('Organism identified', isolateOrganism.value);
    await openCulture(selected.value);
  } catch (caught) {
    toast.error('Could not add isolate', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function addAst(): Promise<void> {
  if (!selected.value || !selected.value.isolates[0] || !astAntibiotic.value) return;
  saving.value = true;
  try {
    await api.post(`/micro/cultures/${selected.value.id}/ast`, {
      isolateId: selected.value.isolates[0].id,
      antibioticCode: astAntibiotic.value,
      method: astMethod.value,
      value: Number(astValue.value),
    });
    toast.success('AST interpreted', 'Breakpoint applied automatically.');
    await openCulture(selected.value);
    antibiogram.value = await api.get<AntibiogramRow[]>('/micro/antibiogram');
  } catch (caught) {
    toast.error('AST rejected', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function downloadWhonet(): Promise<void> {
  try {
    await documents.download('/micro/whonet', 'whonet-export.csv');
  } catch (caught) {
    toast.error('Export failed', apiErrorMessage(caught));
  }
}

function interpretationClass(value: string): string {
  return value === 'R' ? 'text-danger' : value === 'I' ? 'text-warning' : 'text-success';
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Microbiology"
      title="Culture, identification and susceptibility"
      description="Culture lifecycle, isolate identification, CLSI/EUCAST AST interpretation, resistance flags, antibiogram and WHONET export."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" /> Refresh
        </button>
        <button type="button" class="btn btn-secondary" @click="downloadWhonet">
          <AppIcon name="download" :size="13" /> WHONET
        </button>
        <button v-if="canCreate" type="button" class="btn btn-primary" @click="createOpen = true">
          <AppIcon name="plus" :size="13" /> New culture
        </button>
      </template>
      <template #meta
        ><span>{{ cultures.length }} cultures</span
        ><span>{{ antibiogram.length }} antibiogram rows</span></template
      >
    </PageHeader>
    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="8" />
    <div v-else class="grid gap-5 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,2.2fr)]">
      <section class="panel h-fit">
        <div class="border-b border-line px-4 py-3">
          <p class="label-caps">Culture bench</p>
          <p class="mt-1 text-xs text-muted">Plate, incubate, read and report.</p>
        </div>
        <div v-if="cultures.length === 0" class="p-5 text-sm text-muted">
          No cultures. Create one from a microbiology request.
        </div>
        <div v-else class="divide-y divide-line">
          <button
            v-for="culture in cultures"
            :key="culture.id"
            type="button"
            class="w-full px-4 py-3 text-left hover:bg-raised"
            :class="selectedCultureId === culture.id ? 'bg-accent/[0.06]' : ''"
            @click="openCulture(culture)"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="mono text-[10px] text-accent">{{ culture.accessionNumber }}</p>
                <p class="mt-0.5 text-sm font-medium">{{ culture.patientName }}</p>
                <p class="mt-0.5 text-[11px] text-muted">{{ culture.specimenType }}</p>
              </div>
              <span
                class="font-mono text-[9px] uppercase tracking-wide2"
                :class="culture.status === 'REPORTED' ? 'text-success' : 'text-muted'"
                >{{ MICROBIOLOGY_CULTURE_STATUS_LABELS[culture.status] ?? culture.status }}</span
              >
            </div>
            <p v-if="culture.resistanceFlags.length" class="mt-1 font-mono text-[9px] text-danger">
              {{ culture.resistanceFlags.join(' · ') }}
            </p>
          </button>
        </div>
      </section>

      <section v-if="selected" class="min-w-0 space-y-4">
        <div class="panel">
          <div
            class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4"
          >
            <div>
              <p class="label-caps">{{ selected.specimenType }}</p>
              <h2 class="mt-1 display text-xl">{{ selected.patientName }}</h2>
              <p class="mt-1 text-xs text-muted">
                {{ selected.accessionNumber }} · {{ selected.plateType ?? 'No plate' }} ·
                {{ selected.incubation ?? 'No incubation' }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="option in statusOptions"
                :key="option.value"
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="saving"
                @click="setStatus(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
          <div class="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p class="label-caps">Organism</p>
              <p class="mt-1 text-sm">{{ selected.organismName ?? 'Not identified' }}</p>
              <p class="mt-1 text-xs text-muted">{{ selected.colonyCount ?? 'No colony count' }}</p>
            </div>
            <div>
              <p class="label-caps">Resistance flags</p>
              <p
                class="mt-1 text-sm"
                :class="selected.resistanceFlags.length ? 'text-danger' : 'text-muted'"
              >
                {{
                  selected.resistanceFlags.length ? selected.resistanceFlags.join(' · ') : 'None'
                }}
              </p>
            </div>
            <div class="sm:col-span-2">
              <p class="label-caps">Notes</p>
              <p class="mt-1 whitespace-pre-line text-sm text-muted">
                {{ selected.notes ?? 'No notes.' }}
              </p>
            </div>
          </div>
        </div>

        <div class="panel p-5">
          <p class="label-caps">Identification</p>
          <div class="mt-3 flex flex-wrap items-end gap-2">
            <SearchSelect
              v-model="isolateOrganism"
              :options="organismOptions"
              :full-width="false"
              class="w-auto min-w-[240px]"
              placeholder="Select organism"
            />
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="saving || !isolateOrganism"
              @click="addIsolate"
            >
              Add isolate
            </button>
          </div>
          <div v-if="selected.isolates.length" class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="isolate in selected.isolates"
              :key="isolate.id"
              class="border border-line bg-canvas px-2 py-1 text-xs"
              >{{ isolate.organismName }} <span class="text-muted">{{ isolate.gram }}</span></span
            >
          </div>
        </div>

        <div class="panel p-5">
          <p class="label-caps">Susceptibility</p>
          <div class="mt-3 grid gap-2 sm:grid-cols-4">
            <SearchSelect
              v-model="astAntibiotic"
              :options="antibioticOptions"
              placeholder="Antibiotic"
            />
            <SearchSelect
              v-model="astMethod"
              :options="[
                { value: 'MIC', label: 'MIC' },
                { value: 'DISK', label: 'Disk diffusion' },
              ]"
              placeholder="Method"
            />
            <input v-model="astValue" type="number" step="any" class="input" placeholder="Value" />
            <button
              type="button"
              class="btn btn-primary"
              :disabled="saving || !selected.isolates.length || !astAntibiotic || !astValue"
              @click="addAst"
            >
              Interpret
            </button>
          </div>
          <div class="mt-4 overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Antibiotic</th>
                  <th>Method</th>
                  <th>Value</th>
                  <th>Breakpoint</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in selected.susceptibilities" :key="row.id">
                  <td class="text-sm">{{ row.antibioticName }}</td>
                  <td class="text-xs">{{ row.method }}</td>
                  <td class="mono text-xs">{{ row.value }} {{ row.unit }}</td>
                  <td class="text-xs text-muted">{{ row.standard ?? '—' }}</td>
                  <td>
                    <span
                      class="font-mono text-[10px]"
                      :class="interpretationClass(row.interpretation)"
                      >{{ row.interpretation }} ·
                      {{ AST_INTERPRETATION_LABELS[row.interpretation] }}</span
                    >
                  </td>
                </tr>
                <tr v-if="selected.susceptibilities.length === 0">
                  <td colspan="5" class="py-4 text-center text-xs text-muted">
                    No AST results yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <section class="panel mt-5">
      <div class="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p class="label-caps">Antibiogram</p>
          <p class="mt-1 text-xs text-muted">
            Susceptibility by organism and antibiotic from recorded AST results.
          </p>
        </div>
        <span class="font-mono text-[9px] text-muted">{{ antibiogram.length }} rows</span>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Organism</th>
              <th>Antibiotic</th>
              <th>Tested</th>
              <th>S</th>
              <th>I</th>
              <th>R</th>
              <th>%S</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in antibiogram" :key="`${row.organismCode}-${row.antibioticCode}`">
              <td class="text-sm">{{ row.organismName }}</td>
              <td class="text-sm">{{ row.antibioticName }}</td>
              <td class="mono text-xs">{{ row.tested }}</td>
              <td class="mono text-xs text-success">{{ row.susceptible }}</td>
              <td class="mono text-xs text-warning">{{ row.intermediate }}</td>
              <td class="mono text-xs text-danger">{{ row.resistant }}</td>
              <td class="mono text-xs">{{ row.susceptibilityPercent }}%</td>
            </tr>
            <tr v-if="antibiogram.length === 0">
              <td colspan="7" class="py-5 text-center text-xs text-muted">No AST data.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal v-model="createOpen" title="Create culture" :persistent="saving">
      <div class="space-y-3">
        <FormField label="Microbiology request" for-id="culture-request" required
          ><SearchSelect
            id="culture-request"
            v-model="createRequest"
            :options="requestOptions"
            placeholder="Select request"
        /></FormField>
        <FormField label="Specimen type" for-id="culture-specimen"
          ><input id="culture-specimen" v-model="createSpecimen" class="input"
        /></FormField>
        <FormField label="Plate/media" for-id="culture-plate"
          ><input id="culture-plate" v-model="createPlate" class="input"
        /></FormField>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="createOpen = false">Cancel</button
        ><button
          type="button"
          class="btn btn-primary"
          :disabled="saving || !createRequest"
          @click="createCulture"
        >
          Create culture
        </button></template
      >
    </AppModal>
  </div>
</template>
