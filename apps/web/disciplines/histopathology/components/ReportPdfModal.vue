<script setup lang="ts">
const open = defineModel<boolean>({ default: false });
const props = withDefaults(defineProps<{ reportId: string | null; accessionNumber?: string }>(), {
  accessionNumber: '',
});

const api = useApi();
const url = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const blob = ref<Blob | null>(null);

async function load(): Promise<void> {
  if (!props.reportId) return;
  loading.value = true;
  error.value = null;
  try {
    const result = await api.blob(`/reports/${props.reportId}/pdf`);
    blob.value = result;
    if (url.value) URL.revokeObjectURL(url.value);
    url.value = URL.createObjectURL(result);
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [open.value, props.reportId] as const,
  ([isOpen]) => {
    if (isOpen) void load();
  },
);

function download(): void {
  if (!blob.value) return;
  const objectUrl = URL.createObjectURL(blob.value);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${props.accessionNumber || 'report'}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

onBeforeUnmount(() => {
  if (url.value) URL.revokeObjectURL(url.value);
});

watch(open, (value) => {
  if (!value && url.value) {
    URL.revokeObjectURL(url.value);
    url.value = null;
    blob.value = null;
  }
});
</script>

<template>
  <AppModal
    v-model="open"
    title="Report preview"
    :description="`Server-rendered PDF${accessionNumber ? ` for ${accessionNumber}` : ''}`"
    size="xl"
  >
    <div v-if="loading" class="flex min-h-[50vh] items-center justify-center">
      <div class="text-center">
        <AppIcon name="file" :size="28" class="mx-auto animate-pulse text-muted" />
        <p class="mt-3 font-mono text-2xs uppercase tracking-caps text-muted">Rendering PDF…</p>
      </div>
    </div>
    <ErrorState
      v-else-if="error"
      title="PDF could not be generated"
      :message="error"
      @retry="load"
    />
    <iframe
      v-else-if="url"
      :src="url"
      class="h-[70vh] w-full border border-line bg-white"
      title="Report PDF preview"
    />
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="open = false">Close</button>
      <button type="button" class="btn btn-secondary" :disabled="!blob" @click="download">
        <AppIcon name="download" :size="13" />
        Download PDF
      </button>
      <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
        <AppIcon name="refresh" :size="13" />
        Regenerate
      </button>
    </template>
  </AppModal>
</template>
