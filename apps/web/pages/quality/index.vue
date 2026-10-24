<script setup lang="ts">
import type {
  Equipment,
  NonConformance,
  Paginated,
  SendOut,
  TemperatureLog,
  TestRequest,
} from '@lims/shared';
import { NC_SEVERITIES } from '@lims/shared';

definePageMeta({ title: 'Quality management', capabilities: ['quality'] });
useHead({ title: 'Quality management' });

const api = useApi();
const toast = useToast();
const { dateTime } = useFormat();
const equipment = ref<Equipment[]>([]);
const logs = ref<TemperatureLog[]>([]);
const ncs = ref<NonConformance[]>([]);
const sendOuts = ref<SendOut[]>([]);
const requests = ref<TestRequest[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const equipmentOpen = ref(false);
const ncOpen = ref(false);
const sendOutOpen = ref(false);
const capaOpen = ref(false);
const capaTarget = ref<NonConformance | null>(null);
const tempTarget = ref<Equipment | null>(null);
const tempForm = reactive({ temperature: 0, minAllowed: 2, maxAllowed: 8, notes: '' });
const equipmentForm = reactive({
  code: '',
  name: '',
  type: 'Refrigerator',
  serialNumber: '',
  location: '',
  nextCalibrationAt: '',
});
const ncForm = reactive({
  title: '',
  description: '',
  category: 'Pre-analytical',
  severity: 'MINOR' as const,
  dueAt: '',
});
const capaForm = reactive({ action: '', owner: '', dueAt: '' });
const sendOutForm = reactive({
  testRequestId: '',
  referenceLab: '',
  reason: '',
  courier: '',
  trackingNumber: '',
});
const requestOptions = computed(() =>
  requests.value.map((request) => ({
    value: request.id,
    label: `${request.accessionNumber} · ${request.name}`,
  })),
);
const severityOptions = NC_SEVERITIES.map((value) => ({ value, label: value }));

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const equipmentRows = await api.get<Equipment[]>('/quality/equipment');
    const [logRows, ncRows, sendRows, requestPage] = await Promise.all([
      equipmentRows[0]
        ? api
            .get<TemperatureLog[]>(`/quality/equipment/${equipmentRows[0].id}/temperature`)
            .catch(() => [])
        : Promise.resolve([] as TemperatureLog[]),
      api.get<NonConformance[]>('/quality/nonconformances'),
      api.get<SendOut[]>('/quality/send-outs'),
      api.get<Paginated<TestRequest>>('/test-requests', { limit: 100 }),
    ]);
    equipment.value = equipmentRows;
    logs.value = logRows;
    ncs.value = ncRows;
    sendOuts.value = sendRows;
    requests.value = requestPage.items;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function loadLogs(target: Equipment): Promise<void> {
  tempTarget.value = target;
  tempForm.temperature = 0;
  tempForm.minAllowed = 2;
  tempForm.maxAllowed = 8;
  tempForm.notes = '';
  logs.value = await api
    .get<TemperatureLog[]>(`/quality/equipment/${target.id}/temperature`)
    .catch(() => []);
}

async function recordTemperature(): Promise<void> {
  if (!tempTarget.value) return;
  saving.value = true;
  try {
    await api.post(`/quality/equipment/${tempTarget.value.id}/temperature`, {
      ...tempForm,
      unit: '°C',
    });
    toast.success('Temperature recorded', tempTarget.value.name);
    await loadLogs(tempTarget.value);
  } catch (caught) {
    toast.error('Could not record temperature', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function createEquipment(): Promise<void> {
  saving.value = true;
  try {
    await api.post('/quality/equipment', {
      ...equipmentForm,
      nextCalibrationAt: equipmentForm.nextCalibrationAt || undefined,
    });
    equipmentOpen.value = false;
    toast.success('Equipment added', equipmentForm.name);
    await load();
  } catch (caught) {
    toast.error('Could not add equipment', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function createNc(): Promise<void> {
  saving.value = true;
  try {
    await api.post('/quality/nonconformances', { ...ncForm, dueAt: ncForm.dueAt || undefined });
    ncOpen.value = false;
    toast.success('Non-conformance raised', ncForm.title);
    await load();
  } catch (caught) {
    toast.error('Could not raise non-conformance', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

function openCapa(nc: NonConformance): void {
  capaTarget.value = nc;
  capaForm.action = '';
  capaForm.owner = '';
  capaForm.dueAt = '';
  capaOpen.value = true;
}

async function addCapa(): Promise<void> {
  if (!capaTarget.value) return;
  saving.value = true;
  try {
    await api.post(`/quality/nonconformances/${capaTarget.value.id}/capa`, {
      ...capaForm,
      dueAt: capaForm.dueAt || undefined,
    });
    capaOpen.value = false;
    toast.success('CAPA added', capaTarget.value.code);
    await load();
  } catch (caught) {
    toast.error('Could not add CAPA', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function createSendOut(): Promise<void> {
  saving.value = true;
  try {
    await api.post('/quality/send-outs', sendOutForm);
    sendOutOpen.value = false;
    toast.success('Send-out created', sendOutForm.referenceLab);
    await load();
  } catch (caught) {
    toast.error('Could not create send-out', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function moveSendOut(row: SendOut, status: string): Promise<void> {
  try {
    await api.patch(`/quality/send-outs/${row.id}`, { status });
    toast.success('Send-out updated', row.accessionNumber);
    await load();
  } catch (caught) {
    toast.error('Could not update send-out', apiErrorMessage(caught));
  }
}

function statusClass(status: string): string {
  return status === 'REPORTED' || status === 'RECEIVED' || status === 'CLOSED'
    ? 'text-success'
    : status === 'REJECTED' || status === 'CRITICAL'
      ? 'text-danger'
      : 'text-muted';
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Quality management"
      title="Equipment, non-conformances and send-outs"
      description="Temperature monitoring, CAPA, quality events and cross-laboratory referral tracking."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" /> Refresh
        </button>
        <button type="button" class="btn btn-secondary" @click="sendOutOpen = true">
          <AppIcon name="send" :size="13" /> Send-out
        </button>
        <button type="button" class="btn btn-secondary" @click="ncOpen = true">
          <AppIcon name="alert" :size="13" /> Non-conformance
        </button>
        <button type="button" class="btn btn-primary" @click="equipmentOpen = true">
          <AppIcon name="plus" :size="13" /> Equipment
        </button>
      </template>
      <template #meta
        ><span>{{ equipment.length }} equipment</span><span>{{ ncs.length }} NCRs</span
        ><span>{{ sendOuts.length }} send-outs</span></template
      >
    </PageHeader>
    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="8" />
    <div v-else class="grid gap-5 xl:grid-cols-2">
      <section class="panel">
        <div class="border-b border-line px-5 py-4">
          <p class="label-caps">Equipment &amp; temperature</p>
          <p class="mt-1 text-xs text-muted">Select equipment to record a temperature check.</p>
        </div>
        <div class="divide-y divide-line">
          <button
            v-for="item in equipment"
            :key="item.id"
            type="button"
            class="w-full px-5 py-3 text-left hover:bg-raised"
            :class="tempTarget?.id === item.id ? 'bg-accent/[0.06]' : ''"
            @click="loadLogs(item)"
          >
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="text-sm font-medium">{{ item.name }}</p>
                <p class="mono mt-0.5 text-[9px] text-muted">
                  {{ item.code }} · {{ item.type }} · {{ item.location ?? 'No location' }}
                </p>
              </div>
              <span
                class="font-mono text-[9px] uppercase tracking-wide2"
                :class="item.status === 'ACTIVE' ? 'text-success' : 'text-warning'"
                >{{ item.status }}</span
              >
            </div>
            <p v-if="item.nextCalibrationAt" class="mt-1 text-[10px] text-muted">
              Next calibration {{ dateTime(item.nextCalibrationAt) }}
            </p>
          </button>
          <p v-if="equipment.length === 0" class="p-4 text-xs text-muted">
            No equipment configured.
          </p>
        </div>
        <div v-if="tempTarget" class="border-t border-line p-5">
          <p class="label-caps">Record temperature — {{ tempTarget.name }}</p>
          <div class="mt-2 grid gap-2 sm:grid-cols-4">
            <input
              v-model.number="tempForm.temperature"
              type="number"
              step="0.1"
              class="input"
              placeholder="°C"
            /><input
              v-model.number="tempForm.minAllowed"
              type="number"
              step="0.1"
              class="input"
              placeholder="Min"
            /><input
              v-model.number="tempForm.maxAllowed"
              type="number"
              step="0.1"
              class="input"
              placeholder="Max"
            /><button
              type="button"
              class="btn btn-primary"
              :disabled="saving"
              @click="recordTemperature"
            >
              Record
            </button>
          </div>
          <div v-if="logs.length" class="mt-3 space-y-1">
            <p
              v-for="log in logs.slice(0, 5)"
              :key="log.id"
              class="text-[11px]"
              :class="log.inRange ? 'text-muted' : 'text-danger'"
            >
              {{ dateTime(log.recordedAt) }} · {{ log.temperature }}{{ log.unit }} ·
              {{ log.inRange ? 'In range' : 'OUT OF RANGE' }}
            </p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="border-b border-line px-5 py-4">
          <p class="label-caps">Non-conformances &amp; CAPA</p>
          <p class="mt-1 text-xs text-muted">Quality events and corrective actions.</p>
        </div>
        <div class="divide-y divide-line">
          <article v-for="nc in ncs" :key="nc.id" class="px-5 py-4">
            <div class="flex items-start justify-between gap-2">
              <div>
                <p class="mono text-[9px] text-accent">{{ nc.code }}</p>
                <p class="mt-0.5 text-sm font-medium">{{ nc.title }}</p>
                <p class="mt-0.5 text-[11px] text-muted">{{ nc.category }} · {{ nc.severity }}</p>
              </div>
              <span class="font-mono text-[9px] uppercase" :class="statusClass(nc.status)">{{
                nc.status
              }}</span>
            </div>
            <p class="mt-1 line-clamp-2 text-[11px] text-muted">{{ nc.description }}</p>
            <ul v-if="nc.actions.length" class="mt-2 space-y-1">
              <li v-for="action in nc.actions" :key="action.id" class="text-[11px] text-muted">
                CAPA · {{ action.action }}
                <span class="font-mono text-[9px]">{{ action.status }}</span>
              </li>
            </ul>
            <button type="button" class="btn btn-ghost btn-sm mt-2" @click="openCapa(nc)">
              Add CAPA
            </button>
          </article>
          <p v-if="ncs.length === 0" class="p-4 text-xs text-muted">No non-conformances.</p>
        </div>
      </section>
    </div>

    <section class="panel mt-5">
      <div class="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p class="label-caps">Cross-lab send-outs</p>
          <p class="mt-1 text-xs text-muted">Samples referred to another laboratory.</p>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="data-table mobile-cards">
          <thead>
            <tr>
              <th>Case</th>
              <th>Test</th>
              <th>Reference lab</th>
              <th>Courier</th>
              <th>Status</th>
              <th class="text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sendOuts" :key="row.id">
              <td data-label="Case" class="mono text-[10px]">{{ row.accessionNumber }}</td>
              <td data-label="Test" class="text-xs">{{ row.testName }}</td>
              <td data-label="Reference lab" class="text-xs">{{ row.referenceLab }}</td>
              <td data-label="Courier" class="text-xs text-muted">
                {{ row.trackingNumber ?? row.courier ?? '—' }}
              </td>
              <td data-label="Status">
                <span class="font-mono text-[9px]" :class="statusClass(row.status)">{{
                  row.status
                }}</span>
              </td>
              <td data-label="Action" class="text-right">
                <button
                  v-if="row.status === 'SENT'"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="moveSendOut(row, 'IN_TRANSIT')"
                >
                  Dispatch</button
                ><button
                  v-if="row.status === 'IN_TRANSIT'"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="moveSendOut(row, 'RECEIVED')"
                >
                  Receive</button
                ><button
                  v-if="row.status === 'RECEIVED'"
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="moveSendOut(row, 'REPORTED')"
                >
                  Report
                </button>
              </td>
            </tr>
            <tr v-if="sendOuts.length === 0">
              <td colspan="6" class="py-5 text-center text-xs text-muted">No send-outs.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppModal v-model="equipmentOpen" title="Add equipment" :persistent="saving"
      ><div class="grid gap-3 sm:grid-cols-2">
        <FormField label="Code" for-id="eq-code" required
          ><input
            id="eq-code"
            v-model="equipmentForm.code"
            class="input font-mono uppercase" /></FormField
        ><FormField label="Name" for-id="eq-name" required
          ><input id="eq-name" v-model="equipmentForm.name" class="input" /></FormField
        ><FormField label="Type" for-id="eq-type"
          ><input id="eq-type" v-model="equipmentForm.type" class="input" /></FormField
        ><FormField label="Serial" for-id="eq-serial"
          ><input id="eq-serial" v-model="equipmentForm.serialNumber" class="input" /></FormField
        ><FormField label="Location" for-id="eq-location"
          ><input id="eq-location" v-model="equipmentForm.location" class="input" /></FormField
        ><FormField label="Next calibration" for-id="eq-cal"
          ><input id="eq-cal" v-model="equipmentForm.nextCalibrationAt" type="date" class="input"
        /></FormField>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="equipmentOpen = false">Cancel</button
        ><button type="button" class="btn btn-primary" :disabled="saving" @click="createEquipment">
          Add equipment
        </button></template
      ></AppModal
    >
    <AppModal v-model="ncOpen" title="Raise non-conformance" :persistent="saving"
      ><div class="space-y-3">
        <FormField label="Title" for-id="nc-title" required
          ><input id="nc-title" v-model="ncForm.title" class="input" /></FormField
        ><FormField label="Description" for-id="nc-desc" required>
          <textarea id="nc-desc" v-model="ncForm.description" class="textarea min-h-[100px]" />
        </FormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Category" for-id="nc-cat"
            ><input id="nc-cat" v-model="ncForm.category" class="input" /></FormField
          ><FormField label="Severity" for-id="nc-sev"
            ><SearchSelect
              id="nc-sev"
              v-model="ncForm.severity"
              :options="severityOptions" /></FormField
          ><FormField label="Due date" for-id="nc-due"
            ><input id="nc-due" v-model="ncForm.dueAt" type="date" class="input"
          /></FormField>
        </div>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="ncOpen = false">Cancel</button
        ><button type="button" class="btn btn-primary" :disabled="saving" @click="createNc">
          Raise
        </button></template
      ></AppModal
    >
    <AppModal
      v-model="capaOpen"
      title="Add CAPA"
      :description="capaTarget?.code"
      :persistent="saving"
      ><div class="space-y-3">
        <FormField label="Action" for-id="capa-action" required>
          <textarea id="capa-action" v-model="capaForm.action" class="textarea min-h-[90px]" />
        </FormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Owner" for-id="capa-owner"
            ><input id="capa-owner" v-model="capaForm.owner" class="input" /></FormField
          ><FormField label="Due date" for-id="capa-due"
            ><input id="capa-due" v-model="capaForm.dueAt" type="date" class="input"
          /></FormField>
        </div>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="capaOpen = false">Cancel</button
        ><button type="button" class="btn btn-primary" :disabled="saving" @click="addCapa">
          Save CAPA
        </button></template
      ></AppModal
    >
    <AppModal v-model="sendOutOpen" title="Cross-lab send-out" :persistent="saving"
      ><div class="space-y-3">
        <FormField label="Test request" for-id="send-request" required
          ><SearchSelect
            id="send-request"
            v-model="sendOutForm.testRequestId"
            :options="requestOptions"
            placeholder="Select request" /></FormField
        ><FormField label="Reference laboratory" for-id="send-lab" required
          ><input id="send-lab" v-model="sendOutForm.referenceLab" class="input"
        /></FormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Courier" for-id="send-courier"
            ><input id="send-courier" v-model="sendOutForm.courier" class="input" /></FormField
          ><FormField label="Tracking number" for-id="send-tracking"
            ><input id="send-tracking" v-model="sendOutForm.trackingNumber" class="input"
          /></FormField>
        </div>
        <FormField label="Reason" for-id="send-reason"
          ><input id="send-reason" v-model="sendOutForm.reason" class="input"
        /></FormField>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="sendOutOpen = false">Cancel</button
        ><button
          type="button"
          class="btn btn-primary"
          :disabled="saving || !sendOutForm.testRequestId"
          @click="createSendOut"
        >
          Create send-out
        </button></template
      ></AppModal
    >
  </div>
</template>
