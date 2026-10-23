<script setup lang="ts">
import type { CaseListItem, Paginated, UserSummary } from '@lims/shared';
import {
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  SUBSPECIALTIES,
} from '@lims/shared';

definePageMeta({ title: 'Cases', capabilities: ['cases'] });
useHead({ title: 'Case register' });

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const casesApi = useCases();

const items = ref<CaseListItem[]>([]);
const total = ref(0);
const totalPages = ref(1);
const page = ref(1);
const limit = 20;
const loading = ref(true);
const error = ref<string | null>(null);
const pathologists = ref<UserSummary[]>([]);

const filters = reactive({
  q: '',
  status: typeof route.query.status === 'string' ? route.query.status : '',
  priority: typeof route.query.priority === 'string' ? route.query.priority : '',
  pathologistId: typeof route.query.pathologistId === 'string' ? route.query.pathologistId : '',
  subspecialty: typeof route.query.subspecialty === 'string' ? route.query.subspecialty : '',
});

const activeFilterCount = computed(
  () =>
    [
      filters.q,
      filters.status,
      filters.priority,
      filters.pathologistId,
      filters.subspecialty,
    ].filter(Boolean).length,
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const query: Record<string, string | number> = { page: page.value, limit };
    if (filters.q.trim()) query.q = filters.q.trim();
    if (filters.status) query.status = filters.status;
    if (filters.priority) query.priority = filters.priority;
    if (filters.pathologistId) query.pathologistId = filters.pathologistId;
    if (filters.subspecialty) query.subspecialty = filters.subspecialty;
    const result = await api.get<Paginated<CaseListItem>>('/cases', query);
    items.value = result.items;
    total.value = result.total;
    totalPages.value = result.totalPages;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

const debouncedSearch = useDebounceFn(() => {
  page.value = 1;
  void load();
}, 280);

watch(
  () => filters.q,
  () => debouncedSearch(),
);

watch(
  [
    () => filters.status,
    () => filters.priority,
    () => filters.pathologistId,
    () => filters.subspecialty,
  ],
  () => {
    page.value = 1;
    void load();
  },
);

watch(page, () => load());

function nextPage(): void {
  if (page.value < totalPages.value) page.value += 1;
}

function previousPage(): void {
  if (page.value > 1) page.value -= 1;
}

function clearFilters(): void {
  filters.q = '';
  filters.status = '';
  filters.priority = '';
  filters.pathologistId = '';
  filters.subspecialty = '';
  page.value = 1;
  void load();
}

onMounted(async () => {
  void load();
  try {
    pathologists.value = await casesApi.pathologists();
  } catch {
    pathologists.value = [];
  }
});
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Case register"
      title="Every accession, one ledger"
      description="Search by accession, MRN or patient name. Filter the register without losing sight of turnaround."
    >
      <template #meta>
        <span class="mono">{{ total }} cases</span>
        <span v-if="activeFilterCount > 0">{{ activeFilterCount }} filters active</span>
      </template>
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" :class="{ 'animate-spin': loading }" /> Refresh
        </button>
        <NuxtLink v-if="auth.can('accession')" to="/accession" class="btn btn-primary">
          <AppIcon name="plus" :size="13" /> New accession
        </NuxtLink>
      </template>
    </PageHeader>

    <section class="panel mb-4 p-3 sm:p-4" aria-label="Case filters">
      <div class="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
        <div class="relative">
          <AppIcon
            name="search"
            :size="14"
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            v-model="filters.q"
            type="search"
            class="input pl-9"
            placeholder="Accession, MRN or patient"
            aria-label="Search cases"
          />
        </div>
        <select v-model="filters.status" class="select" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option v-for="status in CASE_STATUSES" :key="status" :value="status">
            {{ CASE_STATUS_LABELS[status] }}
          </option>
        </select>
        <select v-model="filters.priority" class="select" aria-label="Filter by priority">
          <option value="">All priorities</option>
          <option v-for="priority in PRIORITIES" :key="priority" :value="priority">
            {{ PRIORITY_LABELS[priority] }}
          </option>
        </select>
        <select v-model="filters.pathologistId" class="select" aria-label="Filter by pathologist">
          <option value="">All pathologists</option>
          <option v-for="pathologist in pathologists" :key="pathologist.id" :value="pathologist.id">
            {{ pathologist.name }}
          </option>
        </select>
        <select v-model="filters.subspecialty" class="select" aria-label="Filter by subspecialty">
          <option value="">All subspecialties</option>
          <option v-for="subspecialty in SUBSPECIALTIES" :key="subspecialty" :value="subspecialty">
            {{ subspecialty }}
          </option>
        </select>
        <button
          v-if="activeFilterCount > 0"
          type="button"
          class="btn btn-ghost justify-start md:col-span-2 xl:col-span-1"
          @click="clearFilters"
        >
          <AppIcon name="close" :size="12" /> Clear
        </button>
      </div>
    </section>

    <ErrorState v-if="error" :message="error" @retry="load" />

    <div v-else class="panel">
      <LoadingSkeleton v-if="loading && items.length === 0" kind="table" :rows="8" />
      <EmptyState
        v-else-if="!loading && items.length === 0"
        icon="cases"
        title="No cases match"
        :message="
          activeFilterCount > 0
            ? 'Adjust the filters or clear them to see the full register.'
            : 'The register is empty. Accession the first case to begin.'
        "
        :bordered="false"
      >
        <button
          v-if="activeFilterCount > 0"
          type="button"
          class="btn btn-secondary"
          @click="clearFilters"
        >
          Clear filters
        </button>
        <NuxtLink v-else-if="auth.can('accession')" to="/accession" class="btn btn-primary">
          Accession a case
        </NuxtLink>
      </EmptyState>
      <CaseTable v-else :cases="items" />
      <div
        v-if="items.length > 0"
        class="flex flex-col items-start justify-between gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center"
      >
        <p class="font-mono text-[10px] uppercase tracking-wide2 text-muted">
          Page {{ page }} of {{ totalPages }} · {{ total }} cases
        </p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="page <= 1 || loading"
            @click="previousPage"
          >
            <AppIcon name="arrow-left" :size="12" /> Previous
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="page >= totalPages || loading"
            @click="nextPage"
          >
            Next <AppIcon name="arrow-right" :size="12" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
