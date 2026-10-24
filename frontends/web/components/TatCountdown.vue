<script setup lang="ts">
import { computeTat, describeTat } from '@lims/shared';

const props = withDefaults(
  defineProps<{
    startedAt: string;
    deadline: string;
    warningPercent?: number;
    done?: boolean;
    compact?: boolean;
  }>(),
  { warningPercent: 80, done: false, compact: false },
);

const now = useNow({ interval: 1_000 });
const tat = computed(() =>
  computeTat(props.startedAt, props.deadline, {
    warningPercent: props.warningPercent,
    done: props.done,
    now: now.value,
  }),
);

const stateClass = computed(() => {
  if (tat.value.state === 'DONE') return 'text-success';
  if (tat.value.state === 'BREACHED') return 'text-danger';
  if (tat.value.state === 'WARNING') return 'text-warning';
  return 'text-ink';
});

const barClass = computed(() => {
  if (tat.value.state === 'DONE') return 'bg-success';
  if (tat.value.state === 'BREACHED') return 'bg-danger';
  if (tat.value.state === 'WARNING') return 'bg-warning';
  return 'bg-ink/60';
});

const display = computed(() => describeTat(tat.value));
</script>

<template>
  <div
    v-if="compact"
    class="flex min-w-[112px] items-center gap-2"
    role="timer"
    :aria-label="`Turnaround: ${display}`"
  >
    <span class="h-1 w-10 shrink-0 overflow-hidden bg-line" aria-hidden="true">
      <span
        class="block h-full transition-[width] duration-700"
        :class="barClass"
        :style="{ width: `${tat.state === 'DONE' ? 100 : tat.elapsedPercent}%` }"
      />
    </span>
    <span class="tabular font-mono text-[11px] font-medium" :class="stateClass">{{ display }}</span>
  </div>
  <div
    v-else
    class="border border-line bg-canvas/50 p-3.5"
    role="timer"
    :aria-label="`Turnaround: ${display}`"
  >
    <div class="flex items-baseline justify-between gap-3">
      <span class="label-caps">Turnaround</span>
      <span class="tabular font-mono text-lg font-medium" :class="stateClass">{{ display }}</span>
    </div>
    <div class="mt-2.5 h-1.5 w-full overflow-hidden bg-line" aria-hidden="true">
      <div
        class="h-full transition-[width] duration-700"
        :class="barClass"
        :style="{ width: `${tat.state === 'DONE' ? 100 : Math.min(100, tat.elapsedPercent)}%` }"
      />
    </div>
    <div
      class="mt-2 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-wide2 text-muted"
    >
      <span>{{
        done
          ? 'Completed'
          : tat.state === 'BREACHED'
            ? 'Breached'
            : `${tat.elapsedPercent}% elapsed`
      }}</span>
      <span
        >Due
        {{
          new Date(deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        }}</span
      >
    </div>
  </div>
</template>
