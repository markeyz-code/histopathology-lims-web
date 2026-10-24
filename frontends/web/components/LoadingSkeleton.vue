<script setup lang="ts">
withDefaults(
  defineProps<{
    rows?: number;
    label?: string;
    kind?: 'table' | 'cards' | 'text';
  }>(),
  { rows: 4, label: 'Loading', kind: 'cards' },
);
</script>

<template>
  <div :aria-label="label" role="status">
    <span class="sr-only">{{ label }}</span>
    <div v-if="kind === 'table'" class="border border-line bg-surface">
      <div class="h-9 border-b border-line-strong bg-canvas/60" />
      <div
        v-for="row in rows"
        :key="row"
        class="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0"
      >
        <div class="h-3 w-24 animate-pulse bg-line/70" />
        <div class="h-3 flex-1 animate-pulse bg-line/50" />
        <div class="h-3 w-16 animate-pulse bg-line/60" />
        <div class="h-5 w-20 animate-pulse bg-line/40" />
      </div>
    </div>
    <div v-else-if="kind === 'text'" class="space-y-2">
      <div
        v-for="row in rows"
        :key="row"
        class="h-3 animate-pulse bg-line/60"
        :style="{ width: `${92 - row * 7}%` }"
      />
    </div>
    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="row in rows" :key="row" class="border border-line bg-surface p-5">
        <div class="h-2.5 w-20 animate-pulse bg-line/70" />
        <div class="mt-4 h-8 w-28 animate-pulse bg-line/50" />
        <div class="mt-4 h-2.5 w-3/4 animate-pulse bg-line/40" />
      </div>
    </div>
  </div>
</template>
