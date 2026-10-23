<script setup lang="ts">
import type { Station } from '@lims/shared';
import {
  STATIONS,
  STATION_DESCRIPTIONS,
  STATION_LABELS,
  STATION_ROLES,
  STATION_TARGET,
} from '@lims/shared';
import type { IconName } from '~/types/icons';

definePageMeta({ title: 'Scan station', capabilities: ['scan'] });
useHead({ title: 'Scan station' });

const auth = useAuthStore();

const stationIcons: Record<Station, IconName> = {
  GROSSING: 'microscope',
  PROCESSING: 'beaker',
  EMBEDDING: 'block',
  MICROTOMY: 'slide',
  STAINING: 'flask',
  PATHOLOGIST: 'stethoscope',
  ARCHIVE: 'archive',
};

const allowedStations = computed(() =>
  STATIONS.filter((station) => auth.role && STATION_ROLES[station].includes(auth.role)),
);

function targetLabel(station: Station): string {
  const targets = STATION_TARGET[station];
  return Object.entries(targets)
    .map(([entity, state]) => `${entity} → ${String(state).toLowerCase()}`)
    .join(' · ');
}
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Scan stations"
      title="Choose the physical station"
      description="Each station advances one event in the custody state machine. Keyboard-wedge scanners work everywhere; Enter submits."
    >
      <template #meta>
        <span class="mono">{{ auth.role }}</span>
        <span
          >{{ allowedStations.length }} station{{
            allowedStations.length === 1 ? '' : 's'
          }}
          available to you</span
        >
      </template>
    </PageHeader>

    <div v-if="allowedStations.length === 0">
      <EmptyState
        icon="scan"
        title="No scan stations for your role"
        message="Scanning is restricted by role. Ask the laboratory administrator if you need station access."
      />
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="(station, index) in allowedStations"
        :key="station"
        :to="`/scan/${station.toLowerCase()}`"
        class="group relative flex flex-col overflow-hidden border border-line bg-surface p-5 transition-colors hover:border-ink"
      >
        <div class="flex items-start justify-between gap-3">
          <span class="font-mono text-2xs uppercase tracking-caps text-muted">
            {{ String(index + 1).padStart(2, '0') }} / {{ STATION_LABELS[station] }}
          </span>
          <span
            class="flex h-9 w-9 items-center justify-center border border-line bg-canvas text-muted transition-colors group-hover:border-accent group-hover:text-accent"
          >
            <AppIcon :name="stationIcons[station]" :size="18" />
          </span>
        </div>
        <h2 class="display mt-6 text-2xl">{{ STATION_LABELS[station] }}</h2>
        <p class="mt-2 flex-1 text-xs leading-relaxed text-muted">
          {{ STATION_DESCRIPTIONS[station] }}
        </p>
        <div
          class="mt-5 border-t border-line pt-3 font-mono text-[9px] uppercase tracking-wide2 text-muted"
        >
          {{ targetLabel(station) }}
        </div>
        <span
          class="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-caps text-accent"
        >
          Enter station <AppIcon name="arrow-right" :size="11" />
        </span>
      </NuxtLink>
    </div>

    <section class="mt-8 grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
      <div class="flex gap-3">
        <AppIcon name="keyboard" :size="18" class="mt-0.5 shrink-0 text-accent" />
        <div>
          <p class="label-caps">Keyboard-first</p>
          <p class="mt-1 text-xs leading-relaxed text-muted">
            A wedge scanner types the barcode and presses Enter. No mouse needed.
          </p>
        </div>
      </div>
      <div class="flex gap-3">
        <AppIcon name="volume" :size="18" class="mt-0.5 shrink-0 text-accent" />
        <div>
          <p class="label-caps">Instant feedback</p>
          <p class="mt-1 text-xs leading-relaxed text-muted">
            A high-contrast green or red state and an audible tone confirm every scan.
          </p>
        </div>
      </div>
      <div class="flex gap-3">
        <AppIcon name="shield" :size="18" class="mt-0.5 shrink-0 text-accent" />
        <div>
          <p class="label-caps">Never overwritten</p>
          <p class="mt-1 text-xs leading-relaxed text-muted">
            Invalid transitions are rejected. Every accepted scan becomes an immutable event.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
