<script setup lang="ts">
import { STATION_LABELS, type CustodyEvent } from '@lims/shared';
import type { IconName } from '~/types/icons';

const props = withDefaults(
  defineProps<{
    events: CustodyEvent[];
    max?: number;
    title?: string;
  }>(),
  { max: 24, title: 'Custody timeline' },
);

const { relative, dateTime } = useFormat();
const expanded = ref(false);

const ordered = computed(() => [...props.events].reverse());
const visible = computed(() =>
  expanded.value ? ordered.value : ordered.value.slice(0, props.max),
);

const entityIcons: Record<string, IconName> = {
  CASE: 'clipboard',
  SPECIMEN: 'flask',
  BLOCK: 'block',
  SLIDE: 'slide',
};

function eventLabel(event: CustodyEvent): string {
  return event.eventType.replace(/_/g, ' ').toLowerCase();
}

function detail(event: CustodyEvent): string {
  const label = typeof event.metadata.label === 'string' ? event.metadata.label : null;
  const parts: string[] = [];
  if (label) parts.push(label);
  if (event.station) parts.push(STATION_LABELS[event.station]);
  parts.push(event.userName);
  return parts.join(' · ');
}

const eventTextClass = (event: CustodyEvent): string => {
  if (event.eventType === 'REJECTED') return 'text-danger';
  if (event.eventType === 'RECUT_REQUESTED') return 'text-warning';
  if (event.eventType === 'REPORTED') return 'text-success';
  if (event.eventType === 'AMENDED') return 'text-warning';
  return 'text-ink';
};

const dotClass = (event: CustodyEvent): string => {
  if (event.eventType === 'REJECTED') return 'bg-danger';
  if (event.eventType === 'RECUT_REQUESTED') return 'bg-warning';
  if (event.eventType === 'REPORTED' || event.eventType === 'SIGNED_OUT') return 'bg-success';
  if (event.eventType === 'AMENDED') return 'bg-warning';
  if (event.entityType === 'CASE') return 'bg-accent';
  return 'bg-line-strong';
};
</script>

<template>
  <section>
    <div class="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 class="label-caps">{{ title }}</h2>
        <p class="mt-1 text-xs text-muted">{{ events.length }} immutable events</p>
      </div>
      <span
        class="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide2 text-muted"
      >
        <AppIcon name="shield" :size="12" /> append-only
      </span>
    </div>

    <div
      v-if="events.length === 0"
      class="border border-dashed border-line-strong p-5 text-sm text-muted"
    >
      No custody events recorded yet.
    </div>

    <ol v-else class="relative ml-1.5 border-l border-line">
      <li v-for="event in visible" :key="event.id" class="relative pb-5 pl-5 last:pb-0">
        <span
          class="absolute -left-[4.5px] top-1.5 h-2 w-2 ring-4 ring-canvas"
          :class="dotClass(event)"
          aria-hidden="true"
        />
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <AppIcon
            :name="entityIcons[event.entityType] ?? 'clipboard'"
            :size="12"
            class="text-muted"
          />
          <span
            class="font-mono text-[10px] uppercase tracking-wide2"
            :class="eventTextClass(event)"
          >
            {{ eventLabel(event) }}
          </span>
          <span class="font-mono text-[8px] uppercase tracking-wide2 text-muted">
            {{ event.entityType.toLowerCase() }}
          </span>
          <span class="ml-auto font-mono text-[9px] text-muted" :title="dateTime(event.timestamp)">
            {{ relative(event.timestamp) }}
          </span>
        </div>
        <p class="mt-1 text-xs text-muted">{{ detail(event) }}</p>
        <p v-if="event.reason" class="mt-1 border-l border-line pl-2 text-xs italic text-muted">
          {{ event.reason }}
        </p>
      </li>
    </ol>

    <button
      v-if="ordered.length > max"
      type="button"
      class="mt-3 font-mono text-2xs uppercase tracking-caps text-accent hover:underline"
      @click="expanded = !expanded"
    >
      {{ expanded ? 'Show latest only' : `Show all ${ordered.length} events` }}
    </button>
  </section>
</template>
