<script setup lang="ts">
import type { Station } from '@lims/shared';
import { STATIONS, STATION_LABELS, STATION_ROLES, STATION_TARGET } from '@lims/shared';
import type { IconName } from '~/types/icons';

definePageMeta({ layout: false, title: 'Scan station', capabilities: ['scan'] });
useHead({ title: 'Scan station' });

const route = useRoute();
const auth = useAuthStore();
const scanner = useScanner();
const { time } = useFormat();

const station = computed<Station | null>(() => {
  const raw = String(route.params.station ?? '').toUpperCase();
  return (STATIONS as readonly string[]).includes(raw) ? (raw as Station) : null;
});
const stationIndex = computed(() => (station.value ? STATIONS.indexOf(station.value) + 1 : 0));
const allowed = computed(() =>
  Boolean(station.value && auth.role && STATION_ROLES[station.value].includes(auth.role)),
);

const stationIcons: Record<Station, IconName> = {
  GROSSING: 'microscope',
  PROCESSING: 'beaker',
  EMBEDDING: 'block',
  MICROTOMY: 'slide',
  STAINING: 'flask',
  PATHOLOGIST: 'stethoscope',
  ARCHIVE: 'archive',
};

const expected = computed(() => {
  if (!station.value) return '';
  const targets = STATION_TARGET[station.value];
  return Object.entries(targets)
    .map(([entity, state]) => `${entity} → ${String(state).replace(/_/g, ' ').toLowerCase()}`)
    .join(' · ');
});

const flashClass = computed(() =>
  scanner.flash.value === 'success'
    ? 'border-success'
    : scanner.flash.value === 'queued'
      ? 'border-warning'
      : scanner.flash.value === 'error'
        ? 'border-danger'
        : 'border-transparent',
);

const inputEl = ref<HTMLInputElement | null>(null);
const exitHref = '/scan';

async function submit(): Promise<void> {
  await scanner.scan(station.value as Station);
  await nextTick();
  inputEl.value?.focus();
  if (scanner.lastError.value) inputEl.value?.select();
}

function focusInput(): void {
  inputEl.value?.focus();
}

function clear(): void {
  scanner.barcode.value = '';
  focusInput();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    clear();
  }
}

watch(
  () => scanner.queue.pendingCount.value,
  (count, previous) => {
    if (previous > 0 && count === 0) {
      scanner.offlineNotice.value = null;
    }
  },
);

onMounted(() => {
  nextTick(() => focusInput());
});
</script>

<template>
  <div class="min-h-screen bg-rail text-rail-ink">
    <div
      v-if="scanner.flash.value"
      class="pointer-events-none fixed inset-0 z-50 border-[10px] transition-opacity"
      :class="flashClass"
      aria-hidden="true"
    />

    <header
      class="flex flex-wrap items-center justify-between gap-3 border-b border-rail-line px-4 py-3 sm:px-6"
    >
      <div class="flex items-center gap-4">
        <AppWordmark variant="rail" compact />
        <span class="hidden h-6 w-px bg-rail-line sm:block" />
        <div class="hidden sm:block">
          <p class="font-mono text-[8px] uppercase tracking-[0.18em] text-rail-muted">
            {{ auth.lab?.code }}
          </p>
          <p class="text-xs text-rail-ink">{{ auth.lab?.name }}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <span
          class="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-rail-muted md:block"
        >
          {{ auth.displayName }} · {{ auth.role?.replace('_', ' ') }}
        </span>
        <OfflineQueueBadge />
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center border border-rail-line text-rail-muted transition-colors hover:border-rail-ink/40 hover:text-rail-ink"
          :aria-label="scanner.muted.value ? 'Unmute scan feedback' : 'Mute scan feedback'"
          @click="scanner.toggleMuted()"
        >
          <AppIcon :name="scanner.muted.value ? 'volume-off' : 'volume'" :size="14" />
        </button>
        <NuxtLink
          :to="exitHref"
          class="flex h-8 items-center gap-2 border border-rail-line px-2.5 font-mono text-[9px] uppercase tracking-caps text-rail-muted transition-colors hover:border-rail-ink/40 hover:text-rail-ink"
        >
          <AppIcon name="close" :size="12" /> Exit
        </NuxtLink>
      </div>
    </header>

    <div v-if="!station" class="flex min-h-[70vh] items-center justify-center px-6">
      <div class="max-w-md text-center">
        <AppIcon name="alert" :size="30" class="mx-auto text-danger" />
        <h1 class="display mt-4 text-3xl">Unknown scan station</h1>
        <p class="mt-2 text-sm text-rail-muted">
          This station does not exist in the custody workflow.
        </p>
        <NuxtLink
          to="/scan"
          class="btn btn-secondary mt-6 border-rail-line bg-transparent text-rail-ink"
          >Choose a station</NuxtLink
        >
      </div>
    </div>

    <div v-else-if="!allowed" class="flex min-h-[70vh] items-center justify-center px-6">
      <div class="max-w-md text-center">
        <AppIcon name="lock" :size="30" class="mx-auto text-warning" />
        <h1 class="display mt-4 text-3xl">Not your station</h1>
        <p class="mt-2 text-sm text-rail-muted">
          Your role cannot scan at {{ STATION_LABELS[station] }}. Ask the laboratory administrator
          if this is wrong.
        </p>
        <NuxtLink
          to="/scan"
          class="btn btn-secondary mt-6 border-rail-line bg-transparent text-rail-ink"
          >Back to stations</NuxtLink
        >
      </div>
    </div>

    <main v-else class="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
      <div class="flex flex-wrap items-end justify-between gap-4 border-b border-rail-line pb-5">
        <div>
          <p
            class="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-accent"
          >
            <span class="h-1.5 w-1.5 bg-accent" aria-hidden="true" />
            Station {{ String(stationIndex).padStart(2, '0') }} / {{ STATIONS.length }}
          </p>
          <h1 class="display mt-2 text-5xl leading-none sm:text-6xl">
            {{ STATION_LABELS[station] }}
          </h1>
          <p class="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-rail-muted">
            {{ expected }}
          </p>
        </div>
        <div
          class="flex h-12 w-12 items-center justify-center border border-rail-line text-rail-muted"
        >
          <AppIcon :name="stationIcons[station]" :size="24" />
        </div>
      </div>

      <form class="mt-7" @submit.prevent="submit">
        <label
          for="scan-barcode"
          class="mb-2 flex items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-rail-muted"
        >
          <span>Scan or type barcode</span>
          <span>Keyboard wedge ready · Enter to submit</span>
        </label>
        <div class="flex flex-col gap-2 sm:flex-row">
          <div class="relative flex-1">
            <AppIcon
              name="scan"
              :size="22"
              class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-rail-muted"
            />
            <input
              id="scan-barcode"
              ref="inputEl"
              v-model="scanner.barcode.value"
              type="text"
              class="scan-input pl-12 uppercase"
              placeholder="Scan a specimen, block or slide label"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              :disabled="scanner.busy.value"
              aria-describedby="scan-help"
              @keydown="onKeydown"
            />
          </div>
          <button
            type="submit"
            class="btn btn-primary h-auto min-h-[62px] px-8 text-[11px] sm:min-h-0"
            :disabled="scanner.busy.value || !scanner.barcode.value.trim()"
          >
            <AppIcon v-if="scanner.busy.value" name="refresh" :size="16" class="animate-spin" />
            <AppIcon v-else name="arrow-right" :size="16" />
            {{ scanner.busy.value ? 'Checking…' : 'Submit scan' }}
          </button>
        </div>
        <p
          id="scan-help"
          class="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-rail-muted"
        >
          Esc clears the field. Invalid transitions are rejected with the allowed next state.
        </p>
      </form>

      <div
        v-if="scanner.offlineNotice.value"
        class="mt-5 flex flex-wrap items-center justify-between gap-3 border border-warning/50 bg-warning/[0.08] p-4"
        role="status"
      >
        <div>
          <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-warning">Saved offline</p>
          <p class="mt-1 text-sm text-rail-ink">{{ scanner.offlineNotice.value }}</p>
        </div>
        <button
          type="button"
          class="btn btn-secondary border-rail-line bg-transparent text-rail-ink"
          :disabled="scanner.queue.syncing.value || scanner.queue.pendingCount.value === 0"
          @click="scanner.queue.flush()"
        >
          <AppIcon name="refresh" :size="12" />
          Sync {{ scanner.queue.pendingCount.value }} queued
        </button>
      </div>

      <div aria-live="assertive" aria-atomic="true" class="mt-8">
        <div
          v-if="scanner.lastResult.value"
          class="animate-scan-in border p-5 sm:p-6"
          :class="
            scanner.flash.value === 'error'
              ? 'border-danger/60 bg-danger/[0.08]'
              : 'border-success/50 bg-success/[0.07]'
          "
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p
                class="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em]"
                :class="scanner.flash.value === 'error' ? 'text-danger' : 'text-success'"
              >
                <span class="h-1.5 w-1.5 bg-current" aria-hidden="true" />
                Scan accepted
              </p>
              <p class="display mt-2 text-5xl leading-none">
                {{ scanner.lastResult.value.entity.label }}
              </p>
              <p class="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-rail-muted">
                {{ scanner.lastResult.value.entity.accessionNumber }} ·
                {{ scanner.lastResult.value.entity.patientName }}
              </p>
            </div>
            <div class="text-right">
              <p class="font-mono text-[9px] uppercase tracking-[0.18em] text-rail-muted">
                Transition
              </p>
              <p class="mt-1 font-mono text-xs">
                <span class="text-rail-muted">{{
                  scanner.lastResult.value.transition.from.replace(/_/g, ' ')
                }}</span>
                <span class="mx-2 text-accent">→</span>
                <span class="text-rail-ink">{{
                  scanner.lastResult.value.transition.to.replace(/_/g, ' ')
                }}</span>
              </p>
            </div>
          </div>
          <p class="mt-4 border-t border-rail-line/70 pt-4 text-sm text-rail-ink">
            {{ scanner.lastResult.value.message }}
          </p>
          <p class="mt-1 text-xs text-rail-muted">{{ scanner.lastResult.value.nextHint }}</p>
          <NuxtLink
            :to="`/cases/${scanner.lastResult.value.entity.caseId}`"
            class="mt-4 inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-caps text-accent hover:underline"
          >
            Open case {{ scanner.lastResult.value.entity.accessionNumber }}
            <AppIcon name="external" :size="11" />
          </NuxtLink>
        </div>

        <div
          v-else-if="scanner.lastError.value"
          class="animate-scan-in border border-danger/60 bg-danger/[0.08] p-5 sm:p-6"
        >
          <p
            class="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.2em] text-danger"
          >
            <span class="h-1.5 w-1.5 bg-danger" aria-hidden="true" />
            Scan rejected
          </p>
          <p class="mt-2 text-sm leading-relaxed text-rail-ink">{{ scanner.lastError.value }}</p>
          <p class="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-rail-muted">
            The barcode is retained and selected. Correct or rescan.
          </p>
        </div>

        <div v-else class="border border-dashed border-rail-line p-5 text-sm text-rail-muted">
          Waiting for a scan. Each accepted scan writes an immutable custody event and advances the
          projected state.
        </div>
      </div>

      <section class="mt-9">
        <div class="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 class="font-mono text-[9px] uppercase tracking-[0.2em] text-rail-muted">
              This session
            </h2>
            <p class="mt-1 text-sm text-rail-ink">Recent scans</p>
          </div>
          <span class="font-mono text-[9px] uppercase tracking-[0.14em] text-rail-muted">
            {{ scanner.history.value.length }} event{{
              scanner.history.value.length === 1 ? '' : 's'
            }}
          </span>
        </div>
        <div
          v-if="scanner.history.value.length === 0"
          class="border border-rail-line px-4 py-5 text-xs text-rail-muted"
        >
          No scans yet in this session.
        </div>
        <ul v-else class="divide-y divide-rail-line border border-rail-line">
          <li
            v-for="entry in scanner.history.value.slice(0, 8)"
            :key="entry.id"
            class="flex flex-wrap items-center gap-3 px-4 py-2.5"
          >
            <span
              class="h-1.5 w-1.5 shrink-0"
              :class="entry.ok ? 'bg-success' : 'bg-danger'"
              aria-hidden="true"
            />
            <span class="mono text-[11px] text-rail-ink">{{ entry.label || entry.barcode }}</span>
            <span class="min-w-0 flex-1 truncate text-xs text-rail-muted">{{ entry.message }}</span>
            <span class="font-mono text-[9px] uppercase tracking-[0.12em] text-rail-muted">{{
              time(entry.at)
            }}</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>
