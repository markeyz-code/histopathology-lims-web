<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'rail' | 'default';
    compact?: boolean;
  }>(),
  { variant: 'default', compact: false },
);
</script>

<template>
  <div class="flex items-center gap-3">
    <span
      class="relative flex shrink-0 items-center justify-center bg-accent font-display text-accent-ink"
      :class="compact ? 'h-8 w-8 text-base' : 'h-10 w-10 text-lg'"
    >
      <span class="relative z-10 leading-none">H</span>
      <span
        class="absolute bottom-1 right-1 h-1 w-1"
        :class="variant === 'rail' ? 'bg-rail' : 'bg-accent-ink/70'"
        aria-hidden="true"
      />
    </span>
    <span class="min-w-0">
      <span
        class="block truncate font-mono uppercase leading-none tracking-[0.18em]"
        :class="[
          variant === 'rail' ? 'text-rail-ink' : 'text-ink',
          compact ? 'text-[9px]' : 'text-[10px]',
        ]"
      >
        Histopathology
      </span>
      <span
        class="mt-1 block truncate font-mono uppercase leading-none tracking-[0.12em]"
        :class="[
          variant === 'rail' ? 'text-rail-muted' : 'text-muted',
          compact ? 'text-[7px]' : 'text-[8px]',
        ]"
      >
        Laboratory system
      </span>
    </span>
  </div>
</template>
