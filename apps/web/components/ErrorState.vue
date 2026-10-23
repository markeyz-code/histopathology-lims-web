<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    message: string;
    compact?: boolean;
  }>(),
  { title: 'Something went wrong', compact: false },
);

const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <div
    class="border border-danger/30 bg-danger/[0.04]"
    :class="compact ? 'p-4' : 'p-6'"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <AppIcon name="alert" class="mt-0.5 shrink-0 text-danger" :size="18" />
      <div class="min-w-0 flex-1">
        <h2 class="font-mono text-2xs uppercase tracking-caps text-danger">{{ title }}</h2>
        <p class="mt-1.5 text-sm leading-relaxed text-ink">{{ message }}</p>
        <div v-if="$slots.default || $slots.action" class="mt-3 flex flex-wrap gap-2">
          <slot />
          <slot name="action" />
        </div>
        <button v-else type="button" class="btn btn-secondary btn-sm mt-3" @click="emit('retry')">
          <AppIcon name="refresh" :size="13" />
          Try again
        </button>
      </div>
    </div>
  </div>
</template>
