<script setup lang="ts">
definePageMeta({ layout: 'portal', title: 'Payment status' });
useHead({ title: 'Payment status' });

const api = useApi();
const route = useRoute();
const loading = ref(true);
const error = ref<string | null>(null);
const status = ref<{
  reference: string;
  status: string;
  amount: number;
  invoiceNumber: string | null;
} | null>(null);

onMounted(async () => {
  try {
    status.value = await api.get(`/payments/${String(route.query.reference ?? '')}`);
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div>
    <p class="label-caps mb-2 text-accent">Payment return</p>
    <h1 class="display text-4xl">Back from checkout.</h1>
    <div v-if="error" class="mt-5 border border-danger/40 p-4 text-sm text-danger">{{ error }}</div>
    <LoadingSkeleton v-else-if="loading" class="mt-6" :rows="3" />
    <div v-else-if="status" class="mt-6 border border-line bg-surface p-5">
      <p class="label-caps">Reference</p>
      <p class="mono mt-1 text-sm">{{ status.reference }}</p>
      <p class="mt-4 text-2xl">{{ status.status }}</p>
      <p class="mt-1 text-sm text-muted">
        {{ status.invoiceNumber }} · ₦{{ status.amount.toLocaleString() }}
      </p>
      <NuxtLink to="/admin/billing" class="btn btn-primary mt-5 w-full">Return to billing</NuxtLink>
    </div>
  </div>
</template>
