<script setup lang="ts">
import type { Paginated, ReagentLot, ReagentCategory, Slide, StainRun } from '@lims/shared';
import { REAGENT_CATEGORIES, REAGENT_CATEGORY_LABELS } from '@lims/shared';

definePageMeta({ title: 'Inventory', capabilities: ['inventory'] });
useHead({ title: 'Inventory' });

const api = useApi();
const toast = useToast();
const { date, dateTime } = useFormat();
const lots = ref<ReagentLot[]>([]);
const runs = ref<StainRun[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const filter = ref<'all' | 'expiring' | 'quarantined'>('all');
const createOpen = ref(false);
const validateTarget = ref<ReagentLot | null>(null);
const validationNote = ref('');
const adjustTarget = ref<ReagentLot | null>(null);
const adjustDelta = ref(-1);
const adjustNote = ref('');
const runOpen = ref(false);
const runCases = ref<
  Array<{ id: string; accessionNumber: string; patient: { firstName: string; lastName: string } }>
>([]);
const runSlides = ref<Slide[]>([]);
const loadingSlides = ref(false);
const runForm = reactive({
  caseId: '',
  slideId: '',
  stainName: 'H&E',
  lotId: '',
  quantity: 5,
  equipment: 'Leica ST5020',
});

const form = reactive({
  name: '',
  category: 'REAGENT' as ReagentCategory,
  vendor: '',
  catalogNumber: '',
  lotNumber: '',
  storageLocation: '',
  quantity: 100,
  unit: 'mL',
  receivedAt: new Date().toISOString().slice(0, 10),
  expiresAt: '',
  reorderLevel: 0,
  notes: '',
});

const runCaseOptions = computed(() => [
  { value: '', label: 'Select a case' },
  ...runCases.value.map((item) => ({
    value: item.id,
    label: `${item.accessionNumber} · ${item.patient.firstName} ${item.patient.lastName}`,
  })),
]);
const slideOptions = computed(() => [
  {
    value: '',
    label: loadingSlides.value ? 'Loading slides…' : 'Select a slide awaiting staining',
  },
  ...runSlides.value.map((slide) => ({
    value: slide.id,
    label: `${slide.label} · ${slide.stainType}`,
  })),
]);
const lotOptions = computed(() =>
  usableLots.value.map((lot) => ({
    value: lot.id,
    label: `${lot.name} · ${lot.lotNumber}`,
    description: `${lot.quantity} ${lot.unit} available`,
  })),
);
const categoryOptions = REAGENT_CATEGORIES.map((value) => ({
  value,
  label: REAGENT_CATEGORY_LABELS[value],
}));

const activeLots = computed(() => lots.value.filter((lot) => lot.status === 'ACTIVE'));
const expiringLots = computed(() =>
  activeLots.value.filter(
    (lot) => new Date(lot.expiresAt).getTime() - Date.now() < 30 * 86_400_000,
  ),
);
const quarantined = computed(() => lots.value.filter((lot) => lot.status === 'QUARANTINED'));
const usableLots = computed(() =>
  activeLots.value.filter((lot) => lot.validationStatus === 'VALIDATED'),
);
const displayed = computed(() => {
  if (filter.value === 'expiring') return expiringLots.value;
  if (filter.value === 'quarantined') return quarantined.value;
  return lots.value;
});

async function openRun(): Promise<void> {
  runForm.caseId = '';
  runForm.slideId = '';
  runForm.stainName = 'H&E';
  runForm.lotId = usableLots.value[0]?.id ?? '';
  runForm.quantity = 5;
  runCases.value = [];
  runSlides.value = [];
  runOpen.value = true;
  try {
    const result = await api.get<
      Paginated<{
        id: string;
        accessionNumber: string;
        patient: { firstName: string; lastName: string };
      }>
    >('/cases', { limit: 100 });
    runCases.value = result.items;
  } catch (caught) {
    toast.error('Could not load cases', apiErrorMessage(caught));
  }
}

async function loadRunSlides(caseId: string): Promise<void> {
  runSlides.value = [];
  runForm.slideId = '';
  if (!caseId) return;
  loadingSlides.value = true;
  try {
    const result = await api.get<Paginated<Slide>>('/slides', { caseId, limit: 100 });
    runSlides.value = result.items.filter((slide) =>
      ['CUT', 'STAINED', 'RECUT_REQUESTED'].includes(slide.status),
    );
    runForm.slideId = runSlides.value[0]?.id ?? '';
  } catch (caught) {
    toast.error('Could not load slides', apiErrorMessage(caught));
  } finally {
    loadingSlides.value = false;
  }
}

async function createRun(): Promise<void> {
  if (!runForm.caseId || !runForm.slideId || !runForm.lotId || !runForm.stainName.trim()) {
    toast.error('Complete the run', 'Choose a case, slide, stain and validated lot.');
    return;
  }
  saving.value = true;
  try {
    const run = await api.post<StainRun>('/inventory/stain-runs', {
      caseId: runForm.caseId,
      slideId: runForm.slideId,
      stainType: 'H_AND_E',
      stainName: runForm.stainName,
      equipment: runForm.equipment || undefined,
      lots: [{ lotId: runForm.lotId, quantityUsed: runForm.quantity }],
    });
    await api.post(`/inventory/stain-runs/${run.id}/complete`, {
      qcResult: 'PASS',
      notes: 'QC pass recorded from the inventory workspace.',
    });
    toast.success(
      'Stain run completed',
      'The linked slide is now STAINED and the lot stock is updated.',
    );
    runOpen.value = false;
    await load();
  } catch (caught) {
    toast.error('Stain run blocked', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [lotResult, runResult] = await Promise.all([
      api.get<Paginated<ReagentLot>>('/inventory/lots', { limit: 100 }),
      api.get<Paginated<StainRun>>('/inventory/stain-runs', { limit: 20 }),
    ]);
    lots.value = lotResult.items;
    runs.value = runResult.items;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  Object.assign(form, {
    name: '',
    category: 'REAGENT',
    vendor: '',
    catalogNumber: '',
    lotNumber: '',
    storageLocation: '',
    quantity: 100,
    unit: 'mL',
    receivedAt: new Date().toISOString().slice(0, 10),
    expiresAt: '',
    reorderLevel: 0,
    notes: '',
  });
  createOpen.value = true;
}

async function createLot(): Promise<void> {
  if (!form.name.trim() || !form.vendor.trim() || !form.lotNumber.trim() || !form.expiresAt) {
    toast.error('Complete the lot', 'Product, vendor, lot number and expiry are required.');
    return;
  }
  saving.value = true;
  try {
    await api.post<ReagentLot>('/inventory/lots', {
      name: form.name,
      category: form.category,
      vendor: form.vendor,
      catalogNumber: form.catalogNumber || undefined,
      lotNumber: form.lotNumber,
      storageLocation: form.storageLocation || undefined,
      quantity: form.quantity,
      unit: form.unit,
      receivedAt: new Date(`${form.receivedAt}T00:00:00`).toISOString(),
      expiresAt: new Date(`${form.expiresAt}T23:59:59`).toISOString(),
      reorderLevel: form.reorderLevel,
      notes: form.notes || undefined,
    });
    toast.success('Lot quarantined', 'Validate the lot before it can be used in a stain run.');
    createOpen.value = false;
    await load();
  } catch (caught) {
    toast.error('Could not register the lot', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

function openValidate(lot: ReagentLot): void {
  validateTarget.value = lot;
  validationNote.value = '';
}

async function validateLot(): Promise<void> {
  if (!validateTarget.value) return;
  saving.value = true;
  try {
    await api.post(`/inventory/lots/${validateTarget.value.id}/validate`, {
      note: validationNote.value || undefined,
    });
    toast.success('Lot validated', 'It can now be selected in stain runs.');
    validateTarget.value = null;
    await load();
  } catch (caught) {
    toast.error('Validation failed', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

function openAdjust(lot: ReagentLot): void {
  adjustTarget.value = lot;
  adjustDelta.value = -1;
  adjustNote.value = '';
}

async function adjustLot(): Promise<void> {
  if (!adjustTarget.value) return;
  saving.value = true;
  try {
    await api.post(`/inventory/lots/${adjustTarget.value.id}/adjust`, {
      delta: adjustDelta.value,
      note: adjustNote.value || undefined,
    });
    toast.success('Stock adjusted', 'The change is in the audit log.');
    adjustTarget.value = null;
    await load();
  } catch (caught) {
    toast.error('Could not adjust stock', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

function statusClass(lot: ReagentLot): string {
  if (lot.status === 'ACTIVE') return 'text-success';
  if (lot.status === 'EXPIRED' || lot.status === 'REJECTED') return 'text-danger';
  if (lot.status === 'QUARANTINED') return 'text-warning';
  return 'text-muted';
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Laboratory operations"
      title="Reagent &amp; antibody inventory"
      description="Lot-level stock, validation, expiry windows and stain-run traceability. Expired or unvalidated lots cannot enter a run."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" /> Refresh
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="usableLots.length === 0"
          @click="openRun"
        >
          <AppIcon name="flask" :size="13" /> Log stain run
        </button>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <AppIcon name="plus" :size="13" /> Receive lot
        </button>
      </template>
      <template #meta>
        <span>{{ activeLots.length }} active</span>
        <span :class="expiringLots.length ? 'text-warning' : ''"
          >{{ expiringLots.length }} expiring</span
        >
        <span>{{ quarantined.length }} quarantined</span>
      </template>
    </PageHeader>
    <AdminNav />

    <div
      v-if="expiringLots.length"
      class="mb-4 flex flex-wrap items-center justify-between gap-3 border border-warning/40 bg-warning/[0.06] p-3.5"
    >
      <p class="text-xs leading-relaxed text-ink">
        <span class="mono uppercase tracking-caps text-warning"
          >{{ expiringLots.length }} lot{{ expiringLots.length === 1 ? '' : 's' }}</span
        >
        expire within 30 days. Replace them before the validated window closes.
      </p>
      <button type="button" class="btn btn-secondary btn-sm" @click="filter = 'expiring'">
        Review expiring
      </button>
    </div>

    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="option in [
          { key: 'all', label: 'All lots' },
          { key: 'expiring', label: 'Expiring soon' },
          { key: 'quarantined', label: 'Awaiting validation' },
        ]"
        :key="option.key"
        type="button"
        class="border px-3 py-1.5 font-mono text-[9px] uppercase tracking-caps transition-colors"
        :class="
          filter === option.key
            ? 'border-ink bg-ink text-canvas'
            : 'border-line text-muted hover:text-ink'
        "
        @click="filter = option.key as 'all' | 'expiring' | 'quarantined'"
      >
        {{ option.label }}
      </button>
    </div>

    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="6" />

    <div v-else class="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <section class="panel overflow-hidden">
        <div class="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 class="font-mono text-[10px] uppercase tracking-caps text-muted">Lots</h2>
          <span class="mono text-[9px] text-muted">{{ displayed.length }} shown</span>
        </div>
        <div v-if="displayed.length === 0" class="p-8 text-center text-sm text-muted">
          No lots in this view.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="data-table mobile-cards">
            <thead>
              <tr>
                <th>Product</th>
                <th>Lot / vendor</th>
                <th>Expiry</th>
                <th>Stock</th>
                <th>State</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="lot in displayed" :key="lot.id">
                <td data-label="Product">
                  <p class="text-xs font-medium">{{ lot.name }}</p>
                  <p class="mono mt-0.5 text-[9px] uppercase text-muted">
                    {{ REAGENT_CATEGORY_LABELS[lot.category] }}
                  </p>
                </td>
                <td data-label="Lot / vendor">
                  <p class="mono text-[10px]">{{ lot.lotNumber }}</p>
                  <p class="mt-0.5 text-[10px] text-muted">{{ lot.vendor }}</p>
                </td>
                <td
                  data-label="Expiry"
                  :class="new Date(lot.expiresAt) < new Date() ? 'text-danger' : ''"
                >
                  <span class="text-xs">{{ date(lot.expiresAt) }}</span>
                  <p
                    v-if="new Date(lot.expiresAt) < new Date()"
                    class="mono mt-0.5 text-[9px] uppercase"
                  >
                    expired
                  </p>
                </td>
                <td data-label="Stock">
                  <span class="text-xs">{{ lot.quantity }} {{ lot.unit }}</span>
                  <p class="mono mt-0.5 text-[9px] text-muted">of {{ lot.initialQuantity }}</p>
                </td>
                <td data-label="State">
                  <p class="mono text-[9px] uppercase" :class="statusClass(lot)">
                    {{ lot.status }}
                  </p>
                  <p class="mt-0.5 font-mono text-[8px] uppercase text-muted">
                    {{ lot.validationStatus }}
                  </p>
                </td>
                <td data-label="Actions" class="text-right">
                  <div class="flex justify-end gap-1">
                    <button
                      v-if="lot.validationStatus === 'PENDING' && lot.status !== 'EXPIRED'"
                      type="button"
                      class="btn btn-ghost btn-sm text-success"
                      @click="openValidate(lot)"
                    >
                      Validate
                    </button>
                    <button
                      v-if="lot.status !== 'EXPIRED' && lot.status !== 'REJECTED'"
                      type="button"
                      class="btn btn-ghost btn-sm"
                      @click="openAdjust(lot)"
                    >
                      Adjust
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel overflow-hidden">
        <div class="border-b border-line px-4 py-3">
          <h2 class="font-mono text-[10px] uppercase tracking-caps text-muted">
            Recent stain runs
          </h2>
        </div>
        <div v-if="runs.length === 0" class="p-6 text-center text-sm text-muted">
          No stain runs recorded yet.
        </div>
        <div v-else class="divide-y divide-line">
          <article v-for="run in runs" :key="run.id" class="p-4">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-xs font-medium">{{ run.stainName }}</p>
                <p class="mono mt-1 text-[9px] uppercase text-accent">
                  {{ run.accessionNumber
                  }}<template v-if="run.slideLabel"> · {{ run.slideLabel }}</template>
                </p>
                <p class="mono mt-1 text-[9px] uppercase text-muted">
                  {{ run.stainType }} · {{ run.lots.length }} lot{{
                    run.lots.length === 1 ? '' : 's'
                  }}
                </p>
              </div>
              <span
                class="font-mono text-[9px] uppercase"
                :class="
                  run.qcResult === 'PASS'
                    ? 'text-success'
                    : run.qcResult === 'FAIL'
                      ? 'text-danger'
                      : 'text-warning'
                "
                >{{ run.qcResult }}</span
              >
            </div>
            <p class="mt-2 text-[10px] text-muted">
              {{ run.lots.map((lot) => lot.lotNumber).join(' · ') }}
            </p>
            <p class="mt-2 font-mono text-[8px] uppercase tracking-caps text-muted">
              {{ run.completedAt ? dateTime(run.completedAt) : dateTime(run.startedAt) }}
            </p>
          </article>
        </div>
      </section>
    </div>

    <AppModal
      :open="runOpen"
      title="Log a stain run"
      description="Only validated, unexpired lots can be used. A passing QC completes the run and marks the linked slide STAINED."
      @close="runOpen = false"
    >
      <form class="space-y-3" @submit.prevent="createRun">
        <FormField label="Case" for-id="run-case" required>
          <SearchSelect
            id="run-case"
            v-model="runForm.caseId"
            :options="runCaseOptions"
            placeholder="Select a case"
            @change="loadRunSlides(runForm.caseId)"
          />
        </FormField>
        <FormField label="Slide" for-id="run-slide" required>
          <SearchSelect
            id="run-slide"
            v-model="runForm.slideId"
            :options="slideOptions"
            :disabled="loadingSlides || runSlides.length === 0"
            :placeholder="loadingSlides ? 'Loading slides…' : 'Select a slide awaiting staining'"
          />
        </FormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Stain / antibody" for-id="run-name" required
            ><input id="run-name" v-model="runForm.stainName" class="input"
          /></FormField>
          <FormField label="Validated lot" for-id="run-lot" required>
            <SearchSelect
              id="run-lot"
              v-model="runForm.lotId"
              :options="lotOptions"
              placeholder="Select a validated lot"
            />
          </FormField>
          <FormField label="Quantity used" for-id="run-qty"
            ><input
              id="run-qty"
              v-model.number="runForm.quantity"
              type="number"
              min="0.1"
              step="0.1"
              class="input"
          /></FormField>
          <FormField label="Equipment" for-id="run-equipment"
            ><input id="run-equipment" v-model="runForm.equipment" class="input"
          /></FormField>
        </div>
        <p
          v-if="runForm.caseId && !loadingSlides && runSlides.length === 0"
          class="border border-warning/40 bg-warning/[0.06] p-3 text-[11px] text-warning"
        >
          This case has no CUT slides awaiting staining. Cut a slide at microtomy first.
        </p>
        <div class="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" class="btn btn-ghost" @click="runOpen = false">Cancel</button
          ><button type="submit" class="btn btn-primary" :disabled="saving || !runForm.slideId">
            Record passing run
          </button>
        </div>
      </form>
    </AppModal>

    <AppModal
      :open="createOpen"
      title="Receive a reagent lot"
      description="New lots enter quarantine until the laboratory validates them."
      @close="createOpen = false"
    >
      <form class="space-y-3" @submit.prevent="createLot">
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Product name" for-id="lot-name" required
            ><input id="lot-name" v-model="form.name" class="input"
          /></FormField>
          <FormField label="Category" for-id="lot-category">
            <SearchSelect
              id="lot-category"
              v-model="form.category"
              :options="categoryOptions"
              placeholder="Select category"
            />
          </FormField>
          <FormField label="Vendor" for-id="lot-vendor" required
            ><input id="lot-vendor" v-model="form.vendor" class="input"
          /></FormField>
          <FormField label="Catalogue number" for-id="lot-catalog"
            ><input id="lot-catalog" v-model="form.catalogNumber" class="input"
          /></FormField>
          <FormField label="Lot number" for-id="lot-number" required
            ><input id="lot-number" v-model="form.lotNumber" class="input font-mono"
          /></FormField>
          <FormField label="Storage location" for-id="lot-storage"
            ><input id="lot-storage" v-model="form.storageLocation" class="input"
          /></FormField>
          <FormField label="Quantity" for-id="lot-qty" required
            ><input
              id="lot-qty"
              v-model.number="form.quantity"
              type="number"
              min="0"
              step="0.1"
              class="input"
          /></FormField>
          <FormField label="Unit" for-id="lot-unit" required
            ><input id="lot-unit" v-model="form.unit" class="input"
          /></FormField>
          <FormField label="Received" for-id="lot-received" required
            ><input id="lot-received" v-model="form.receivedAt" type="date" class="input"
          /></FormField>
          <FormField label="Expires" for-id="lot-expiry" required
            ><input id="lot-expiry" v-model="form.expiresAt" type="date" class="input"
          /></FormField>
        </div>
        <FormField label="Notes" for-id="lot-notes">
          <textarea id="lot-notes" v-model="form.notes" class="textarea" rows="2" />
        </FormField>
        <div class="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" class="btn btn-ghost" @click="createOpen = false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            <AppIcon name="save" :size="13" /> {{ saving ? 'Saving…' : 'Receive lot' }}
          </button>
        </div>
      </form>
    </AppModal>

    <AppModal :open="Boolean(validateTarget)" title="Validate lot" @close="validateTarget = null">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          Confirm the QC result for {{ validateTarget?.name }} (lot
          {{ validateTarget?.lotNumber }}).
        </p>
        <FormField label="Validation note" for-id="validation-note">
          <textarea
            id="validation-note"
            v-model="validationNote"
            class="textarea"
            rows="2"
            placeholder="Control result, acceptance criteria…"
          />
        </FormField>
        <div class="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" class="btn btn-ghost" @click="validateTarget = null">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="validateLot">
            <AppIcon name="check" :size="13" /> Validate lot
          </button>
        </div>
      </div>
    </AppModal>

    <AppModal :open="Boolean(adjustTarget)" title="Adjust lot stock" @close="adjustTarget = null">
      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{ adjustTarget?.name }} · {{ adjustTarget?.quantity }} {{ adjustTarget?.unit }} on hand.
        </p>
        <FormField label="Change (use a negative number to consume)" for-id="adjust-delta"
          ><input
            id="adjust-delta"
            v-model.number="adjustDelta"
            type="number"
            step="0.1"
            class="input"
        /></FormField>
        <FormField label="Reason" for-id="adjust-note"
          ><input
            id="adjust-note"
            v-model="adjustNote"
            class="input"
            placeholder="Wastage, stock count…"
        /></FormField>
        <div class="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" class="btn btn-ghost" @click="adjustTarget = null">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="adjustLot">
            Apply adjustment
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>
