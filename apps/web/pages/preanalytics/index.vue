<script setup lang="ts">
import type { CollectionCentre, Consignment, Paginated, TestRequest } from '@lims/shared';
import { CONSIGNMENT_STATUS_LABELS, DISCIPLINE_LABELS } from '@lims/shared';

definePageMeta({ title: 'Pre-analytics', capabilities: ['collection'] });
useHead({ title: 'Pre-analytics' });

const api = useApi();
const toast = useToast();
const { dateTime } = useFormat();
const centres = ref<CollectionCentre[]>([]);
const consignments = ref<Consignment[]>([]);
const requests = ref<TestRequest[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const centreOpen = ref(false);
const consignmentOpen = ref(false);
const saving = ref(false);
const selected = ref<string[]>([]);
const centreForm = reactive({ code: '', name: '', address: '', phone: '', homeCollection: false });
const consignmentCentre = ref('');
const riderName = ref('');
const riderPhone = ref('');
const notes = ref('');
const centreOptions = computed(() =>
  centres.value.map((centre) => ({
    value: centre.id,
    label: centre.name,
    description: centre.code,
  })),
);
const statusClass: Record<string, string> = {
  CREATED: 'text-muted',
  DISPATCHED: 'text-accent',
  IN_TRANSIT: 'text-warning',
  RECEIVED: 'text-success',
  REJECTED: 'text-danger',
};

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [centreRows, consignmentRows, requestPage] = await Promise.all([
      api.get<CollectionCentre[]>('/preanalytics/centres'),
      api.get<Consignment[]>('/preanalytics/consignments'),
      api.get<Paginated<TestRequest>>('/test-requests', { status: 'RECEIVED', limit: 100 }),
    ]);
    centres.value = centreRows;
    consignments.value = consignmentRows;
    requests.value = requestPage.items;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function openCentre(): void {
  centreForm.code = '';
  centreForm.name = '';
  centreForm.address = '';
  centreForm.phone = '';
  centreForm.homeCollection = false;
  centreOpen.value = true;
}

async function createCentre(): Promise<void> {
  saving.value = true;
  try {
    await api.post('/preanalytics/centres', centreForm);
    centreOpen.value = false;
    toast.success('Collection centre added', centreForm.name);
    await load();
  } catch (caught) {
    toast.error('Could not add centre', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

function openConsignment(): void {
  selected.value = [];
  consignmentCentre.value = centres.value[0]?.id ?? '';
  riderName.value = '';
  riderPhone.value = '';
  notes.value = '';
  consignmentOpen.value = true;
}

async function createConsignment(): Promise<void> {
  if (selected.value.length === 0) {
    toast.error('Select samples', 'Choose at least one received test request.');
    return;
  }
  saving.value = true;
  try {
    await api.post('/preanalytics/consignments', {
      centreId: consignmentCentre.value,
      testRequestIds: selected.value,
      riderName: riderName.value || null,
      riderPhone: riderPhone.value || null,
      notes: notes.value || null,
    });
    consignmentOpen.value = false;
    toast.success('Consignment created', 'Dispatch it when the rider takes custody.');
    await load();
  } catch (caught) {
    toast.error('Could not create consignment', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function dispatch(consignment: Consignment): Promise<void> {
  try {
    await api.post(`/preanalytics/consignments/${consignment.id}/dispatch`);
    toast.success('Consignment dispatched', consignment.code);
    await load();
  } catch (caught) {
    toast.error('Could not dispatch', apiErrorMessage(caught));
  }
}

async function receive(consignment: Consignment): Promise<void> {
  try {
    await api.post(`/preanalytics/consignments/${consignment.id}/receive`, { accepted: true });
    toast.success('Consignment received', consignment.code);
    await load();
  } catch (caught) {
    toast.error('Could not receive', apiErrorMessage(caught));
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Pre-analytical"
      title="Collection, handoff and receipt"
      description="Collection centres, home collection, rider handoff and laboratory receipt with sample tracking."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" /> Refresh
        </button>
        <button type="button" class="btn btn-primary" @click="openConsignment">
          <AppIcon name="plus" :size="13" /> New consignment
        </button>
      </template>
      <template #meta
        ><span>{{ centres.length }} centres</span
        ><span>{{ consignments.length }} consignments</span></template
      >
    </PageHeader>
    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="8" />
    <div v-else class="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
      <section class="panel">
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p class="label-caps">Consignments</p>
            <p class="mt-1 text-xs text-muted">Rider handoff is a custody event.</p>
          </div>
        </div>
        <div v-if="consignments.length === 0" class="p-6 text-sm text-muted">
          No consignments yet.
        </div>
        <div v-else class="divide-y divide-line">
          <article v-for="consignment in consignments" :key="consignment.id" class="px-5 py-4">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="mono text-[10px] text-accent">{{ consignment.code }}</p>
                <p class="mt-0.5 text-sm font-medium">{{ consignment.centreName }}</p>
                <p class="mt-1 text-[11px] text-muted">
                  {{ consignment.testRequestCount }} samples ·
                  {{ consignment.riderName ?? 'No rider assigned' }}
                </p>
              </div>
              <span
                class="font-mono text-[9px] uppercase tracking-wide2"
                :class="statusClass[consignment.status]"
                >{{ CONSIGNMENT_STATUS_LABELS[consignment.status] }}</span
              >
            </div>
            <p class="mt-2 text-[10px] text-muted">
              Created {{ dateTime(consignment.createdAt)
              }}<span v-if="consignment.dispatchedAt">
                · dispatched {{ dateTime(consignment.dispatchedAt) }}</span
              ><span v-if="consignment.receivedAt">
                · received {{ dateTime(consignment.receivedAt) }}</span
              >
            </p>
            <div class="mt-3 flex gap-2">
              <button
                v-if="consignment.status === 'CREATED' || consignment.status === 'DISPATCHED'"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="dispatch(consignment)"
              >
                Dispatch
              </button>
              <button
                v-if="consignment.status === 'DISPATCHED' || consignment.status === 'IN_TRANSIT'"
                type="button"
                class="btn btn-primary btn-sm"
                @click="receive(consignment)"
              >
                Receive in lab
              </button>
            </div>
          </article>
        </div>
      </section>
      <aside class="panel">
        <div class="flex items-center justify-between border-b border-line px-4 py-3">
          <p class="label-caps">Collection centres</p>
          <button type="button" class="btn btn-ghost btn-sm" @click="openCentre">Add</button>
        </div>
        <div class="divide-y divide-line">
          <div v-for="centre in centres" :key="centre.id" class="px-4 py-3">
            <p class="text-sm font-medium">{{ centre.name }}</p>
            <p class="mono mt-0.5 text-[9px] text-muted">
              {{ centre.code }} · {{ centre.homeCollection ? 'Home collection' : 'Walk-in' }}
            </p>
            <p v-if="centre.phone" class="mt-1 text-[10px] text-muted">{{ centre.phone }}</p>
          </div>
          <p v-if="centres.length === 0" class="p-4 text-xs text-muted">No centres configured.</p>
        </div>
      </aside>
    </div>

    <AppModal v-model="centreOpen" title="Add collection centre" :persistent="saving">
      <div class="grid gap-3 sm:grid-cols-2">
        <FormField label="Code" for-id="centre-code" required
          ><input id="centre-code" v-model="centreForm.code" class="input font-mono uppercase"
        /></FormField>
        <FormField label="Name" for-id="centre-name" required
          ><input id="centre-name" v-model="centreForm.name" class="input"
        /></FormField>
        <FormField label="Phone" for-id="centre-phone"
          ><input id="centre-phone" v-model="centreForm.phone" class="input"
        /></FormField>
        <FormField label="Home collection" for-id="centre-home"
          ><label class="flex h-[42px] items-center gap-2 text-xs"
            ><input
              id="centre-home"
              v-model="centreForm.homeCollection"
              type="checkbox"
              class="h-4 w-4 accent-[rgb(var(--accent))]"
            />
            Offers home collection</label
          ></FormField
        >
        <div class="sm:col-span-2">
          <FormField label="Address" for-id="centre-address"
            ><input id="centre-address" v-model="centreForm.address" class="input"
          /></FormField>
        </div>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="centreOpen = false">Cancel</button
        ><button type="button" class="btn btn-primary" :disabled="saving" @click="createCentre">
          Add centre
        </button></template
      >
    </AppModal>

    <AppModal v-model="consignmentOpen" title="New consignment" :persistent="saving">
      <div class="space-y-4">
        <FormField label="Collection centre" for-id="consignment-centre"
          ><SearchSelect
            id="consignment-centre"
            v-model="consignmentCentre"
            :options="centreOptions"
            placeholder="Select centre"
        /></FormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Rider name" for-id="rider-name"
            ><input id="rider-name" v-model="riderName" class="input"
          /></FormField>
          <FormField label="Rider phone" for-id="rider-phone"
            ><input id="rider-phone" v-model="riderPhone" class="input"
          /></FormField>
        </div>
        <div>
          <p class="field-label">Received samples</p>
          <div class="mt-2 max-h-[260px] space-y-1 overflow-y-auto border border-line p-2">
            <label
              v-for="request in requests"
              :key="request.id"
              class="flex cursor-pointer items-start gap-2 p-2 text-xs hover:bg-raised"
            >
              <input
                v-model="selected"
                type="checkbox"
                :value="request.id"
                class="mt-0.5 h-4 w-4 accent-[rgb(var(--accent))]"
              />
              <span
                ><span class="mono text-[9px] text-accent">{{ request.accessionNumber }}</span
                ><span class="ml-2">{{ request.name }}</span
                ><span class="ml-2 text-muted">{{
                  DISCIPLINE_LABELS[request.discipline]
                }}</span></span
              >
            </label>
            <p v-if="requests.length === 0" class="p-3 text-xs text-muted">
              No received test requests available.
            </p>
          </div>
        </div>
        <FormField label="Notes" for-id="consignment-notes">
          <textarea id="consignment-notes" v-model="notes" class="textarea min-h-[60px]" />
        </FormField>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="consignmentOpen = false">Cancel</button
        ><button
          type="button"
          class="btn btn-primary"
          :disabled="saving"
          @click="createConsignment"
        >
          Create consignment
        </button></template
      >
    </AppModal>
  </div>
</template>
