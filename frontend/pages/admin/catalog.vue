<script setup lang="ts">
import type { Discipline, Paginated, Panel, TestDefinition } from '@lims/shared';
import { DISCIPLINES, DISCIPLINE_LABELS } from '@lims/shared';

definePageMeta({ title: 'Test catalogue', capabilities: ['admin'] });
useHead({ title: 'Test catalogue' });

const api = useApi();
const toast = useToast();
const tests = ref<TestDefinition[]>([]);
const panels = ref<Panel[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const modalOpen = ref(false);
const editing = ref<TestDefinition | null>(null);
const formError = ref<string | null>(null);
const discipline = ref<Discipline>('HAEMATOLOGY');
const disciplineOptions = DISCIPLINES.map((value) => ({ value, label: DISCIPLINE_LABELS[value] }));
const form = reactive({
  code: '',
  name: '',
  specimenType: '',
  method: '',
  active: true,
  analytes: '',
});
const template = JSON.stringify(
  [
    {
      key: 'analyte',
      name: 'Analyte name',
      unit: 'unit',
      resultType: 'NUMERIC',
      required: true,
      referenceRanges: [{ low: 0, high: 0, sex: null, minAge: null, maxAge: null }],
      criticalLow: null,
      criticalHigh: null,
      formula: null,
    },
  ],
  null,
  2,
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [testPage, panelPage] = await Promise.all([
      api.get<Paginated<TestDefinition>>('/catalog/tests', { limit: 100 }),
      api.get<Paginated<Panel>>('/catalog/panels', { limit: 100 }),
    ]);
    tests.value = testPage.items;
    panels.value = panelPage.items;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  form.code = '';
  form.name = '';
  form.specimenType = '';
  form.method = '';
  form.active = true;
  form.analytes = template;
  formError.value = null;
  modalOpen.value = true;
}

function openEdit(test: TestDefinition): void {
  editing.value = test;
  discipline.value = test.discipline;
  form.code = test.code;
  form.name = test.name;
  form.specimenType = test.specimenType;
  form.method = test.method ?? '';
  form.active = test.active;
  form.analytes = JSON.stringify(test.analytes, null, 2);
  formError.value = null;
  modalOpen.value = true;
}

async function save(): Promise<void> {
  formError.value = null;
  let analytes: unknown;
  try {
    analytes = JSON.parse(form.analytes);
  } catch {
    formError.value = 'Analytes must be valid JSON.';
    return;
  }
  saving.value = true;
  try {
    const payload = {
      discipline: discipline.value,
      code: form.code,
      name: form.name,
      specimenType: form.specimenType,
      method: form.method || null,
      active: form.active,
      analytes,
    };
    if (editing.value) {
      await api.patch(`/catalog/tests/${editing.value.id}`, payload);
    } else {
      await api.post('/catalog/tests', payload);
    }
    toast.success(editing.value ? 'Test updated' : 'Test created', form.code.toUpperCase());
    modalOpen.value = false;
    await load();
  } catch (caught) {
    formError.value = apiErrorMessage(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="Test catalogue"
      description="Tenant-configurable tests, analytes, units, reference ranges, critical limits and calculated fields."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" :class="{ 'animate-spin': loading }" /> Refresh
        </button>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <AppIcon name="plus" :size="13" /> New test
        </button>
      </template>
      <template #meta
        ><span>{{ tests.length }} tests</span><span>{{ panels.length }} panels</span></template
      >
    </PageHeader>
    <AdminNav />
    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="8" />
    <div v-else class="space-y-5">
      <section class="panel">
        <div
          class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4"
        >
          <div>
            <p class="label-caps">Tests</p>
            <p class="mt-1 text-xs text-muted">
              Active and inactive definitions used by result entry.
            </p>
          </div>
          <span class="font-mono text-[9px] uppercase tracking-wide2 text-muted"
            >{{ tests.length }} definitions</span
          >
        </div>
        <div class="overflow-x-auto">
          <table class="data-table mobile-cards">
            <thead>
              <tr>
                <th>Discipline</th>
                <th>Test</th>
                <th>Specimen</th>
                <th>Analytes</th>
                <th>Status</th>
                <th class="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="test in tests" :key="test.id">
                <td data-label="Discipline" class="text-xs text-muted">
                  {{ DISCIPLINE_LABELS[test.discipline] }}
                </td>
                <td data-label="Test">
                  <p class="mono text-[10px] text-accent">{{ test.code }}</p>
                  <p class="mt-0.5 text-sm font-medium">{{ test.name }}</p>
                </td>
                <td data-label="Specimen" class="text-xs text-muted">{{ test.specimenType }}</td>
                <td data-label="Analytes" class="text-xs">{{ test.analytes.length }}</td>
                <td data-label="Status">
                  <span
                    class="font-mono text-[9px] uppercase tracking-wide2"
                    :class="test.active ? 'text-success' : 'text-muted'"
                    >{{ test.active ? 'Active' : 'Inactive' }}</span
                  >
                </td>
                <td data-label="Action" class="text-right">
                  <button type="button" class="btn btn-ghost btn-sm" @click="openEdit(test)">
                    Edit
                  </button>
                </td>
              </tr>
              <tr v-if="tests.length === 0">
                <td colspan="6" class="py-8 text-center text-xs text-muted">
                  No test definitions yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel p-5">
        <p class="label-caps">Panels</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="panel in panels"
            :key="panel.id"
            class="border border-line bg-canvas px-2.5 py-1.5 text-xs"
          >
            <span class="mono text-[9px] text-accent">{{ panel.code }}</span> · {{ panel.name }}
          </span>
          <span v-if="panels.length === 0" class="text-xs text-muted">No panels configured.</span>
        </div>
      </section>
    </div>

    <AppModal
      v-model="modalOpen"
      :title="editing ? 'Edit test definition' : 'New test definition'"
      :persistent="saving"
    >
      <div class="space-y-4">
        <div
          v-if="formError"
          class="border border-danger/40 bg-danger/[0.05] p-3 text-xs text-danger"
          role="alert"
        >
          {{ formError }}
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Discipline" for-id="catalog-discipline"
            ><SearchSelect
              id="catalog-discipline"
              v-model="discipline"
              :options="disciplineOptions"
          /></FormField>
          <FormField label="Code" for-id="catalog-code" required
            ><input
              id="catalog-code"
              v-model="form.code"
              class="input font-mono uppercase"
              placeholder="FBC"
          /></FormField>
          <FormField label="Name" for-id="catalog-name" required
            ><input
              id="catalog-name"
              v-model="form.name"
              class="input"
              placeholder="Full blood count"
          /></FormField>
          <FormField label="Specimen" for-id="catalog-specimen" required
            ><input
              id="catalog-specimen"
              v-model="form.specimenType"
              class="input"
              placeholder="EDTA blood"
          /></FormField>
          <FormField label="Method" for-id="catalog-method"
            ><input id="catalog-method" v-model="form.method" class="input"
          /></FormField>
          <FormField label="Active" for-id="catalog-active"
            ><label class="flex h-[42px] items-center gap-2 text-xs"
              ><input
                id="catalog-active"
                v-model="form.active"
                type="checkbox"
                class="h-4 w-4 accent-[rgb(var(--accent))]"
              />
              Available in result entry</label
            ></FormField
          >
        </div>
        <FormField
          label="Analytes JSON"
          for-id="catalog-analytes"
          required
          hint="Each analyte: key, name, unit, resultType, referenceRanges, criticalLow, criticalHigh, formula."
        >
          <textarea
            id="catalog-analytes"
            v-model="form.analytes"
            class="textarea min-h-[260px] font-mono text-[11px]"
            spellcheck="false"
          />
        </FormField>
      </div>
      <template #footer>
        <button type="button" class="btn btn-ghost" :disabled="saving" @click="modalOpen = false">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save test' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
