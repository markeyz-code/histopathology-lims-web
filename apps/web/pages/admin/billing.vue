<script setup lang="ts">
import type { Invoice, InvoiceItem, Paginated, PayerType, Payment } from '@lims/shared';
import { INVOICE_STATUS_LABELS, PAYER_TYPES, PAYER_TYPE_LABELS } from '@lims/shared';

definePageMeta({ title: 'Billing', capabilities: ['billing'] });
useHead({ title: 'Billing' });

const api = useApi();
const toast = useToast();
const documents = useDocuments();
const { date } = useFormat();
const invoices = ref<Invoice[]>([]);
const cases = ref<
  Array<{ id: string; accessionNumber: string; patient: { firstName: string; lastName: string } }>
>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const createOpen = ref(false);
const payTarget = ref<Invoice | null>(null);
const manualTarget = ref<Invoice | null>(null);
const provider = ref<'PAYSTACK' | 'FLUTTERWAVE'>('PAYSTACK');
const amount = ref(0);
const manualProvider = ref<'CASH' | 'TRANSFER' | 'HMO'>('TRANSFER');
const manualReference = ref('');
const manualNote = ref('');
const claimFrom = ref(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
const claimTo = ref(new Date().toISOString().slice(0, 10));

const form = reactive({
  caseId: '',
  payerType: 'SELF' as PayerType,
  hmoName: '',
  authorizationNumber: '',
  description: 'Histopathology professional fee',
  quantity: 1,
  unitPrice: 45_000,
  discount: 0,
  dueAt: '',
});

const caseOptions = computed(() =>
  cases.value.map((item) => ({
    value: item.id,
    label: `${item.accessionNumber} · ${item.patient.firstName} ${item.patient.lastName}`,
    keywords: `${item.patient.firstName} ${item.patient.lastName} ${item.accessionNumber}`,
  })),
);
const payerOptions = PAYER_TYPES.map((value) => ({ value, label: PAYER_TYPE_LABELS[value] }));
const onlineProviderOptions = [
  { value: 'PAYSTACK', label: 'Paystack' },
  { value: 'FLUTTERWAVE', label: 'Flutterwave' },
];
const manualProviderOptions = [
  { value: 'CASH', label: 'Cash' },
  { value: 'TRANSFER', label: 'Bank transfer' },
  { value: 'HMO', label: 'HMO remittance' },
];

const outstanding = computed(() =>
  invoices.value.reduce((sum, invoice) => sum + invoice.balance, 0),
);
const collected = computed(() =>
  invoices.value.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [invoiceResult, caseResult] = await Promise.all([
      api.get<Paginated<Invoice>>('/invoices', { limit: 100 }),
      api.get<
        Paginated<{
          id: string;
          accessionNumber: string;
          patient: { firstName: string; lastName: string };
        }>
      >('/cases', { limit: 100 }),
    ]);
    invoices.value = invoiceResult.items;
    cases.value = caseResult.items.map((item) => ({
      id: item.id,
      accessionNumber: item.accessionNumber,
      patient: item.patient,
    }));
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  Object.assign(form, {
    caseId: cases.value[0]?.id ?? '',
    payerType: 'SELF',
    hmoName: '',
    authorizationNumber: '',
    description: 'Histopathology professional fee',
    quantity: 1,
    unitPrice: 45_000,
    discount: 0,
    dueAt: '',
  });
  createOpen.value = true;
}

async function createInvoice(): Promise<void> {
  if (!form.caseId || !form.description.trim()) {
    toast.error('Complete the invoice', 'Choose a case and describe the charge.');
    return;
  }
  saving.value = true;
  try {
    await api.post<Invoice>('/invoices', {
      caseId: form.caseId,
      payerType: form.payerType,
      hmoName: form.hmoName || undefined,
      authorizationNumber: form.authorizationNumber || undefined,
      items: [
        {
          description: form.description,
          quantity: form.quantity,
          unitPrice: form.unitPrice,
          category: 'PROFESSIONAL',
        },
      ],
      discount: form.discount,
      dueAt: form.dueAt ? new Date(`${form.dueAt}T23:59:59`).toISOString() : undefined,
    });
    toast.success('Invoice issued', 'The balance is ready for payment.');
    createOpen.value = false;
    await load();
  } catch (caught) {
    toast.error('Could not create invoice', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function initialize(): Promise<void> {
  if (!payTarget.value) return;
  saving.value = true;
  try {
    const payment = await api.post<Payment>(`/invoices/${payTarget.value.id}/payments/initialize`, {
      provider: provider.value,
      amount: amount.value || undefined,
    });
    if (payment.checkoutUrl) {
      window.open(payment.checkoutUrl, '_blank', 'noopener');
      toast.success('Checkout opened', 'Complete the provider checkout, then return here.');
    }
    payTarget.value = null;
    await load();
  } catch (caught) {
    toast.error('Could not start payment', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function manual(): Promise<void> {
  if (!manualTarget.value || !manualReference.value.trim()) {
    toast.error('Reference required', 'Record the transfer, cash receipt or HMO reference.');
    return;
  }
  saving.value = true;
  try {
    await api.post<Payment>(`/invoices/${manualTarget.value.id}/payments/manual`, {
      provider: manualProvider.value,
      amount: amount.value || manualTarget.value.balance,
      reference: manualReference.value.trim(),
      note: manualNote.value || undefined,
    });
    toast.success('Payment recorded', 'The invoice balance has been updated.');
    manualTarget.value = null;
    manualReference.value = '';
    amount.value = 0;
    await load();
  } catch (caught) {
    toast.error('Could not record payment', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function exportClaims(): Promise<void> {
  try {
    await documents.download(
      `/claims/export?format=csv&from=${claimFrom.value}&to=${claimTo.value}`,
      `hmo-claims-${claimFrom.value}.csv`,
    );
  } catch (caught) {
    toast.error('Could not export claims', apiErrorMessage(caught));
  }
}

function openPay(invoice: Invoice): void {
  payTarget.value = invoice;
  amount.value = invoice.balance;
  provider.value = 'PAYSTACK';
}

function openManual(invoice: Invoice): void {
  manualTarget.value = invoice;
  amount.value = invoice.balance;
  manualReference.value = '';
  manualProvider.value = 'TRANSFER';
}

function statusClass(invoice: Invoice): string {
  if (invoice.status === 'PAID') return 'text-success border-success/40 bg-success/10';
  if (invoice.status === 'PARTIALLY_PAID') return 'text-warning border-warning/40 bg-warning/10';
  if (invoice.status === 'VOID') return 'text-muted border-line';
  return 'text-ink border-line bg-canvas';
}

onMounted(load);
void ([] as InvoiceItem[]);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Revenue cycle"
      title="Invoices &amp; claims"
      description="Self-pay, HMO and corporate invoices; Paystack/Flutterwave checkout; manual receipts; HMO claims export."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" /> Refresh
        </button>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <AppIcon name="plus" :size="13" /> New invoice
        </button>
      </template>
    </PageHeader>
    <AdminNav />

    <div class="mb-5 grid grid-cols-2 border border-line bg-surface sm:grid-cols-4">
      <div class="border-r border-line p-4">
        <p class="label-caps">Invoices</p>
        <p class="display mt-1 text-2xl">{{ invoices.length }}</p>
      </div>
      <div class="border-r border-line p-4">
        <p class="label-caps">Collected</p>
        <p class="display mt-1 text-2xl">₦{{ collected.toLocaleString() }}</p>
      </div>
      <div class="border-r border-line p-4">
        <p class="label-caps">Outstanding</p>
        <p class="display mt-1 text-2xl" :class="outstanding ? 'text-warning' : ''">
          ₦{{ outstanding.toLocaleString() }}
        </p>
      </div>
      <div class="p-4">
        <p class="label-caps">HMO invoices</p>
        <p class="display mt-1 text-2xl">
          {{ invoices.filter((item) => item.payerType === 'HMO').length }}
        </p>
      </div>
    </div>

    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="6" />
    <div v-else class="panel overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 class="font-mono text-[10px] uppercase tracking-caps text-muted">Invoices</h2>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="claimFrom"
            type="date"
            class="input input-sm w-auto"
            aria-label="Claims from"
          />
          <span class="text-xs text-muted">to</span>
          <input
            v-model="claimTo"
            type="date"
            class="input input-sm w-auto"
            aria-label="Claims to"
          />
          <button type="button" class="btn btn-secondary btn-sm" @click="exportClaims">
            <AppIcon name="download" :size="12" /> HMO claims CSV
          </button>
        </div>
      </div>
      <div v-if="invoices.length === 0" class="p-8 text-center text-sm text-muted">
        No invoices yet.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="data-table mobile-cards">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Patient / case</th>
              <th>Payer</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="invoice in invoices" :key="invoice.id">
              <td data-label="Invoice">
                <p class="mono text-[10px]">{{ invoice.number }}</p>
                <p class="mt-0.5 text-[9px] text-muted">
                  {{ invoice.issuedAt ? date(invoice.issuedAt) : '' }}
                </p>
              </td>
              <td data-label="Patient / case">
                <p class="text-xs font-medium">{{ invoice.patientName }}</p>
                <p class="mono mt-0.5 text-[9px] text-accent">{{ invoice.accessionNumber }}</p>
              </td>
              <td data-label="Payer">
                <p class="text-xs">{{ PAYER_TYPE_LABELS[invoice.payerType] }}</p>
                <p v-if="invoice.hmoName" class="mt-0.5 text-[9px] text-muted">
                  {{ invoice.hmoName }}
                </p>
              </td>
              <td data-label="Total" class="mono text-xs">₦{{ invoice.total.toLocaleString() }}</td>
              <td data-label="Paid" class="mono text-xs">₦{{ invoice.amountPaid.toLocaleString() }}</td>
              <td data-label="Balance" class="mono text-xs">₦{{ invoice.balance.toLocaleString() }}</td>
              <td data-label="Status">
                <span
                  class="border px-2 py-1 font-mono text-[9px] uppercase tracking-caps"
                  :class="statusClass(invoice)"
                  >{{ INVOICE_STATUS_LABELS[invoice.status] }}</span
                >
              </td>
              <td data-label="Actions" class="text-right">
                <div class="flex justify-end gap-1">
                  <button
                    v-if="invoice.balance > 0 && invoice.status !== 'VOID'"
                    type="button"
                    class="btn btn-ghost btn-sm text-accent"
                    @click="openPay(invoice)"
                  >
                    Pay online</button
                  ><button
                    v-if="invoice.balance > 0 && invoice.status !== 'VOID'"
                    type="button"
                    class="btn btn-ghost btn-sm"
                    @click="openManual(invoice)"
                  >
                    Receipt
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <AppModal :open="createOpen" title="New invoice" @close="createOpen = false">
      <form class="space-y-3" @submit.prevent="createInvoice">
        <FormField label="Case" for-id="invoice-case" required>
          <SearchSelect
            id="invoice-case"
            v-model="form.caseId"
            :options="caseOptions"
            placeholder="Search accession or patient"
            search-placeholder="Accession, MRN or patient…"
          />
        </FormField>
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Payer" for-id="invoice-payer">
            <SearchSelect
              id="invoice-payer"
              v-model="form.payerType"
              :options="payerOptions"
              placeholder="Select payer"
            />
          </FormField>
          <FormField v-if="form.payerType === 'HMO'" label="HMO name" for-id="invoice-hmo"
            ><input id="invoice-hmo" v-model="form.hmoName" class="input" placeholder="Hygeia HMO"
          /></FormField>
          <FormField
            v-if="form.payerType === 'HMO'"
            label="Authorization number"
            for-id="invoice-auth"
            ><input id="invoice-auth" v-model="form.authorizationNumber" class="input"
          /></FormField>
          <FormField label="Amount (₦)" for-id="invoice-price"
            ><input
              id="invoice-price"
              v-model.number="form.unitPrice"
              type="number"
              min="0"
              class="input"
          /></FormField>
        </div>
        <FormField label="Description" for-id="invoice-desc"
          ><input id="invoice-desc" v-model="form.description" class="input"
        /></FormField>
        <div class="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" class="btn btn-ghost" @click="createOpen = false">Cancel</button
          ><button type="submit" class="btn btn-primary" :disabled="saving">Issue invoice</button>
        </div>
      </form>
    </AppModal>

    <AppModal
      :open="Boolean(payTarget)"
      title="Online payment"
      :description="
        payTarget ? `${payTarget.number} · balance ₦${payTarget.balance.toLocaleString()}` : ''
      "
      @close="payTarget = null"
    >
      <div v-if="payTarget" class="space-y-3">
        <FormField label="Provider" for-id="pay-provider">
          <SearchSelect
            id="pay-provider"
            v-model="provider"
            :options="onlineProviderOptions"
            placeholder="Select provider"
          />
        </FormField>
        <FormField label="Amount (₦)" for-id="pay-amount"
          ><input
            id="pay-amount"
            v-model.number="amount"
            type="number"
            min="1"
            :max="payTarget.balance"
            class="input"
        /></FormField>
        <p class="text-[11px] leading-relaxed text-muted">
          The provider checkout opens in a new tab. In mock mode, the checkout page completes the
          payment locally for demonstration.
        </p>
        <div class="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" class="btn btn-ghost" @click="payTarget = null">Cancel</button
          ><button type="button" class="btn btn-primary" :disabled="saving" @click="initialize">
            Open checkout
          </button>
        </div>
      </div>
    </AppModal>

    <AppModal
      :open="Boolean(manualTarget)"
      title="Record a payment"
      :description="
        manualTarget
          ? `${manualTarget.number} · balance ₦${manualTarget.balance.toLocaleString()}`
          : ''
      "
      @close="manualTarget = null"
    >
      <div v-if="manualTarget" class="space-y-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Method" for-id="manual-provider">
            <SearchSelect
              id="manual-provider"
              v-model="manualProvider"
              :options="manualProviderOptions"
              placeholder="Select method"
            />
          </FormField>
          <FormField label="Amount (₦)" for-id="manual-amount"
            ><input
              id="manual-amount"
              v-model.number="amount"
              type="number"
              min="1"
              :max="manualTarget.balance"
              class="input"
          /></FormField>
        </div>
        <FormField label="Receipt / reference" for-id="manual-ref" required
          ><input id="manual-ref" v-model="manualReference" class="input font-mono"
        /></FormField>
        <FormField label="Note" for-id="manual-note"
          ><input id="manual-note" v-model="manualNote" class="input"
        /></FormField>
        <div class="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" class="btn btn-ghost" @click="manualTarget = null">Cancel</button
          ><button type="button" class="btn btn-primary" :disabled="saving" @click="manual">
            Record payment
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>
