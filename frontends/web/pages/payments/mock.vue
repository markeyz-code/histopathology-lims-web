<script setup lang="ts">
definePageMeta({ layout: 'portal', title: 'Mock payment' });
useHead({ title: 'Mock payment' });

const api = useApi();
const route = useRoute();
const loading = ref(true);
const paying = ref(false);
const error = ref<string | null>(null);
const payment = ref<{
  reference: string;
  status: string;
  amount: number;
  currency: string;
  invoiceNumber: string | null;
  balance: number | null;
  checkoutUrl: string | null;
} | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  try {
    payment.value = await api.get(`/payments/${String(route.query.reference ?? '')}`);
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function pay(): Promise<void> {
  if (!payment.value) return;
  paying.value = true;
  try {
    payment.value = await api.post(`/payments/mock/${payment.value.reference}/complete`);
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    paying.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <p class="label-caps mb-2 text-accent">Local payment sandbox</p>
    <h1 class="display text-4xl">Complete payment.</h1>
    <p class="mt-3 text-sm leading-relaxed text-muted">
      This page only exists when <span class="mono text-ink">PAYMENTS_MODE=mock</span>. No card data
      is collected and no live provider is called.
    </p>
    <div v-if="error" class="mt-5 border border-danger/40 bg-danger/[0.05] p-4 text-sm text-danger">
      {{ error }}
    </div>
    <LoadingSkeleton v-else-if="loading" class="mt-6" :rows="3" />
    <div v-else-if="payment" class="mt-6 border border-line bg-surface p-5">
      <p class="label-caps">Invoice</p>
      <p class="mono mt-1 text-sm">{{ payment.invoiceNumber ?? '—' }}</p>
      <p class="display mt-5 text-4xl">₦{{ payment.amount.toLocaleString() }}</p>
      <p class="mt-1 text-xs text-muted">
        {{ payment.currency }} · reference {{ payment.reference }}
      </p>
      <p
        v-if="payment.status === 'SUCCESS'"
        class="mt-5 border border-success/40 bg-success/10 p-3 text-sm text-success"
      >
        Payment confirmed. The invoice balance has been updated.
      </p>
      <button
        v-else
        type="button"
        class="btn btn-primary mt-5 w-full"
        :disabled="paying"
        @click="pay"
      >
        <AppIcon name="billing" :size="14" /> {{ paying ? 'Processing…' : 'Pay now (sandbox)' }}
      </button>
      <NuxtLink to="/admin/billing" class="btn btn-ghost mt-2 w-full">Back to billing</NuxtLink>
    </div>
  </div>
</template>
