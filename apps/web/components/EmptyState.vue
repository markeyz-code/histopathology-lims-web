<script setup lang="ts">
import type { IconName } from '~/types/icons';

withDefaults(
  defineProps<{
    icon?: IconName;
    title: string;
    message?: string;
    bordered?: boolean;
  }>(),
  { icon: 'cases', bordered: true },
);
</script>

<template>
  <div
    class="flex flex-col items-center justify-center px-6 py-14 text-center"
    :class="bordered ? 'border border-dashed border-line-strong bg-surface/50' : ''"
  >
    <div
      class="mb-4 flex h-12 w-12 items-center justify-center border border-line-strong bg-canvas text-muted"
    >
      <AppIcon :name="icon" :size="22" />
    </div>
    <h2 class="display text-xl">{{ title }}</h2>
    <p v-if="message" class="mt-2 max-w-md text-sm leading-relaxed text-muted">{{ message }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
