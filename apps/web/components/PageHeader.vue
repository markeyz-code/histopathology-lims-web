<script setup lang="ts">
withDefaults(
  defineProps<{
    eyebrow?: string;
    title: string;
    description?: string;
    backTo?: string;
    backLabel?: string;
  }>(),
  { backLabel: 'Back' },
);
</script>

<template>
  <header class="mb-7 border-b border-line pb-5">
    <NuxtLink
      v-if="backTo"
      :to="backTo"
      class="mb-4 inline-flex items-center gap-2 font-mono text-2xs uppercase tracking-caps text-muted transition-colors hover:text-accent"
    >
      <AppIcon name="arrow-left" :size="13" />
      {{ backLabel }}
    </NuxtLink>
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <p v-if="eyebrow" class="label-caps mb-2 flex items-center gap-2">
          <span class="inline-block h-1.5 w-1.5 bg-accent" aria-hidden="true" />
          {{ eyebrow }}
        </p>
        <h1 class="display text-3xl leading-tight tracking-tight sm:text-4xl">{{ title }}</h1>
        <p v-if="description" class="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          {{ description }}
        </p>
      </div>
      <div v-if="$slots.actions" class="flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
    <div
      v-if="$slots.meta"
      class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted"
    >
      <slot name="meta" />
    </div>
  </header>
</template>
