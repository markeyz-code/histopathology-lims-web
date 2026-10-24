<script setup lang="ts">
const queue = useOfflineQueue();
onMounted(() => {
  void queue.refresh();
});
</script>

<template>
  <button
    v-if="queue.pendingCount.value > 0 || !queue.online.value"
    type="button"
    class="flex h-8 items-center gap-1.5 border border-warning/40 bg-warning/10 px-2 font-mono text-[9px] uppercase tracking-caps text-warning"
    :title="queue.lastError.value ?? 'Offline mutation queue'"
    :disabled="queue.syncing.value"
    @click="queue.flush()"
  >
    <AppIcon
      :name="queue.online.value ? 'refresh' : 'wifi-off'"
      :size="12"
      :class="{ 'animate-spin': queue.syncing.value }"
    />
    {{ queue.online.value ? `${queue.pendingCount.value} queued` : 'offline' }}
  </button>
</template>
