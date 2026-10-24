<script setup lang="ts">
import { STATION_LABELS, type LocatorResult } from '@lims/shared';

definePageMeta({ title: 'Specimen locator', capabilities: ['locator'] });
useHead({ title: 'Specimen locator' });

const route = useRoute();
const router = useRouter();
const api = useApi();
const toast = useToast();
const documents = useDocuments();
const { date, relative } = useFormat();

const query = ref(typeof route.query.q === 'string' ? route.query.q : '');
const result = ref<LocatorResult | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const searched = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);

async function search(): Promise<void> {
  const value = query.value.trim();
  if (!value) return;
  loading.value = true;
  error.value = null;
  searched.value = true;
  try {
    result.value = await api.get<LocatorResult>(`/custody/locator/${encodeURIComponent(value)}`);
    await router.replace({ path: '/locator', query: { q: value } });
  } catch (caught) {
    result.value = null;
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function printLabel(): Promise<void> {
  if (!result.value) return;
  const type = result.value.entityType.toLowerCase() as 'specimen' | 'block' | 'slide';
  try {
    await documents.openLabel(type, result.value.entity.id);
  } catch (caught) {
    toast.error('Label unavailable', apiErrorMessage(caught));
  }
}

function reset(): void {
  query.value = '';
  result.value = null;
  error.value = null;
  searched.value = false;
  void router.replace({ path: '/locator' });
  inputEl.value?.focus();
}

onMounted(() => {
  if (query.value) void search();
  else nextTick(() => inputEl.value?.focus());
});
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Find anything physical"
      title="Specimen locator"
      description="Scan or type any specimen, block or slide barcode to see where it is and everything that has happened to it."
    >
      <template #meta>
        <span>Data Matrix / QR barcode</span>
        <span>Full append-only history</span>
      </template>
    </PageHeader>

    <form class="panel flex flex-col gap-2 p-3 sm:flex-row" @submit.prevent="search">
      <div class="relative flex-1">
        <AppIcon
          name="search"
          :size="18"
          class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          ref="inputEl"
          v-model="query"
          type="search"
          class="input mono border-line-strong py-3 pl-11 text-base uppercase tracking-wide"
          placeholder="SP-…, BL-… or SL-… barcode"
          aria-label="Specimen, block or slide barcode"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <button type="submit" class="btn btn-primary px-6" :disabled="loading || !query.trim()">
        <AppIcon name="pin" :size="14" />
        {{ loading ? 'Locating…' : 'Locate' }}
      </button>
      <button v-if="searched" type="button" class="btn btn-ghost" @click="reset">Clear</button>
    </form>

    <div class="mt-5">
      <LoadingSkeleton v-if="loading" :rows="5" />

      <ErrorState v-else-if="error" title="Nothing located" :message="error" compact>
        <button type="button" class="btn btn-secondary btn-sm" @click="inputEl?.focus()">
          Scan again
        </button>
      </ErrorState>

      <template v-else-if="result">
        <div class="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <div class="space-y-5">
            <section class="panel overflow-hidden">
              <div
                class="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-canvas/50 px-5 py-5 sm:px-6"
              >
                <div>
                  <p class="label-caps">{{ result.entityType }}</p>
                  <p class="display mt-1 text-6xl leading-none">{{ result.entity.label }}</p>
                  <p class="mono mt-2 text-[11px] text-muted">{{ result.entity.barcode }}</p>
                </div>
                <div class="text-right">
                  <StatusChip :status="result.entity.status" kind="stage" />
                  <p class="mt-3 font-mono text-[9px] uppercase tracking-wide2 text-muted">
                    Current location
                  </p>
                  <p class="mt-1 display text-xl">
                    {{ result.currentLocation?.label ?? 'Unknown' }}
                  </p>
                </div>
              </div>

              <div class="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                <div>
                  <p class="label-caps">Case</p>
                  <NuxtLink
                    :to="`/cases/${result.case.id}`"
                    class="mt-1 block font-mono text-sm text-accent hover:underline"
                  >
                    {{ result.case.accessionNumber }}
                  </NuxtLink>
                  <p class="mt-2 text-sm">{{ result.case.patientName }}</p>
                  <p class="mono text-[10px] text-muted">{{ result.case.patientMrn }}</p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <StatusChip :status="result.case.status" kind="case" size="sm" />
                    <StatusChip :status="result.case.priority" kind="priority" size="sm" />
                  </div>
                </div>
                <div>
                  <p class="label-caps">Hierarchy</p>
                  <div class="mt-2 space-y-1.5">
                    <div
                      v-if="result.specimen"
                      class="flex items-center gap-2 border border-line px-2.5 py-1.5"
                    >
                      <AppIcon name="flask" :size="12" class="text-muted" />
                      <span class="mono text-[11px]">{{ result.specimen.label }}</span>
                      <span class="truncate text-[10px] text-muted">{{
                        result.specimen.specimenType
                      }}</span>
                    </div>
                    <div
                      v-if="result.block"
                      class="flex items-center gap-2 border border-line px-2.5 py-1.5"
                    >
                      <AppIcon name="block" :size="12" class="text-muted" />
                      <span class="mono text-[11px]">{{ result.block.label }}</span>
                      <span class="text-[10px] text-muted">Block</span>
                    </div>
                    <div
                      class="flex items-center gap-2 border border-accent bg-accent/[0.05] px-2.5 py-1.5"
                    >
                      <AppIcon
                        :name="
                          result.entityType === 'SLIDE'
                            ? 'slide'
                            : result.entityType === 'BLOCK'
                              ? 'block'
                              : 'flask'
                        "
                        :size="12"
                        class="text-accent"
                      />
                      <span class="mono text-[11px]">{{ result.entity.label }}</span>
                      <span class="text-[10px] text-muted">This item</span>
                    </div>
                  </div>
                </div>
                <div
                  class="sm:col-span-2 flex flex-wrap items-center gap-2 border-t border-line pt-4"
                >
                  <button type="button" class="btn btn-secondary btn-sm" @click="printLabel">
                    <AppIcon name="print" :size="12" /> Print label
                  </button>
                  <NuxtLink :to="`/cases/${result.case.id}`" class="btn btn-secondary btn-sm">
                    <AppIcon name="external" :size="12" /> Open case
                  </NuxtLink>
                  <span class="ml-auto font-mono text-[9px] uppercase tracking-wide2 text-muted">
                    TAT due {{ date(result.case.tatDeadline) }}
                  </span>
                </div>
              </div>
            </section>

            <section class="panel p-5 sm:p-6">
              <CustodyTimeline :events="result.timeline" :max="40" title="Custody history" />
            </section>
          </div>

          <aside class="space-y-4">
            <section class="panel p-5">
              <p class="label-caps">At a glance</p>
              <dl class="mt-3 space-y-2.5 text-xs">
                <div class="flex justify-between gap-3">
                  <dt class="text-muted">Entity</dt>
                  <dd class="font-mono">{{ result.entityType }}</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted">State</dt>
                  <dd><StatusChip :status="result.entity.status" kind="stage" size="sm" /></dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted">Station</dt>
                  <dd>
                    {{
                      result.currentLocation?.station
                        ? STATION_LABELS[result.currentLocation.station]
                        : '—'
                    }}
                  </dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted">Events</dt>
                  <dd class="mono">{{ result.timeline.length }}</dd>
                </div>
                <div class="flex justify-between gap-3">
                  <dt class="text-muted">Last movement</dt>
                  <dd>
                    {{
                      result.timeline.length > 0
                        ? relative(result.timeline[result.timeline.length - 1]?.timestamp)
                        : '—'
                    }}
                  </dd>
                </div>
              </dl>
            </section>

            <section class="border border-line bg-surface p-5">
              <p class="label-caps">What this means</p>
              <p class="mt-2 text-xs leading-relaxed text-muted">
                The state shown here is derived from the most recent immutable custody event — not
                typed in by a user. Scanning the item at its next station moves it forward.
              </p>
            </section>

            <section class="border border-line bg-surface p-5">
              <p class="label-caps">Jump to station</p>
              <div class="mt-3 space-y-1.5">
                <NuxtLink to="/scan" class="btn btn-secondary w-full justify-start">
                  <AppIcon name="scan" :size="12" /> Scan station selector
                </NuxtLink>
                <NuxtLink
                  v-if="result.entityType === 'BLOCK'"
                  :to="`/scan/microtomy`"
                  class="btn btn-secondary w-full justify-start"
                >
                  <AppIcon name="slide" :size="12" /> Microtomy
                </NuxtLink>
                <NuxtLink
                  v-if="result.entityType === 'SLIDE'"
                  :to="`/scan/staining`"
                  class="btn btn-secondary w-full justify-start"
                >
                  <AppIcon name="flask" :size="12" /> Staining
                </NuxtLink>
              </div>
            </section>
          </aside>
        </div>
      </template>

      <EmptyState
        v-else
        icon="pin"
        title="Scan to locate"
        message="Every physical item has a unique Data Matrix barcode. Scan one here to see its current station and full custody trail."
        :bordered="false"
      >
        <p class="font-mono text-[10px] uppercase tracking-wide2 text-muted">
          Try: BL-HP-2026-000004-A1
        </p>
      </EmptyState>
    </div>
  </div>
</template>
