<script setup lang="ts">
import type { PortalCaseSummary } from '@lims/shared';

definePageMeta({ layout: 'portal', title: 'Referral portal' });
useHead({ title: 'My referrals' });

const api = useApi();
const auth = useAuthStore();
const router = useRouter();
const { date } = useFormat();
const loading = ref(true);
const error = ref<string | null>(null);
const cases = ref<PortalCaseSummary[]>([]);
const page = ref(1);
const total = ref(0);
const totalPages = ref(1);

const labels: Record<string, string> = {
  RECEIVED: 'Received',
  IN_PROGRESS: 'In the laboratory',
  READY: 'Report ready',
  RELEASED: 'Report released',
  AMENDED: 'Amended report',
};

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await api.get<{ items: PortalCaseSummary[]; total: number; totalPages: number }>(
      '/portal/cases',
      { page: page.value, limit: 20 },
    );
    cases.value = result.items;
    total.value = result.total;
    totalPages.value = result.totalPages;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function next(): void {
  if (page.value < totalPages.value) {
    page.value += 1;
    void load();
  }
}

function previous(): void {
  if (page.value > 1) {
    page.value -= 1;
    void load();
  }
}

onMounted(() => {
  if (auth.role !== 'REFERRER') {
    void router.push(auth.homePath);
    return;
  }
  void load();
});
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="label-caps mb-3 flex items-center gap-2">
          <span class="h-1.5 w-1.5 bg-accent" /> Referring clinician
        </p>
        <h1 class="display text-4xl leading-tight">My referrals.</h1>
        <p class="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Hello{{ auth.displayName ? `, ${auth.displayName}` : '' }}. Track every specimen you
          referred to {{ auth.lab?.name }} and download released reports.
        </p>
      </div>
    </div>

    <div
      class="mt-6 flex items-center justify-between border-y border-line py-2.5 font-mono text-[9px] uppercase tracking-caps text-muted"
    >
      <span>{{ total }} referral{{ total === 1 ? '' : 's' }}</span>
      <span>{{ auth.lab?.code }} · {{ auth.lab?.timezone }}</span>
    </div>

    <ErrorState v-if="error" class="mt-6" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" class="mt-6" :rows="5" />
    <EmptyState
      v-else-if="cases.length === 0"
      class="mt-6"
      icon="stethoscope"
      title="No referrals yet"
      description="Referrals appear here when the laboratory records your email on a case."
    />

    <div v-else class="mt-4 divide-y divide-line border border-line bg-surface">
      <NuxtLink
        v-for="item in cases"
        :key="item.id"
        :to="`/referrer/cases/${item.id}`"
        class="block px-4 py-4 transition-colors hover:bg-ink/[0.025]"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="font-mono text-xs text-accent">{{ item.accessionNumber }}</p>
            <p class="mt-0.5 truncate text-sm font-medium">{{ item.patientName }}</p>
            <p class="mt-1 font-mono text-[10px] text-muted">
              {{ item.patientMrn }} · received {{ date(item.receivedAt) }}
            </p>
          </div>
          <span
            class="shrink-0 border px-2 py-1 font-mono text-[9px] uppercase tracking-caps"
            :class="
              item.reportAvailable || item.resultsAvailable
                ? 'border-success/40 bg-success/10 text-success'
                : item.referralStatus === 'READY'
                  ? 'border-warning/40 bg-warning/10 text-warning'
                  : 'border-line bg-canvas text-muted'
            "
          >
            {{ labels[item.referralStatus] ?? item.referralStatus }}
          </span>
        </div>
        <div
          class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-caps text-muted"
        >
          <span>{{ item.priority }}</span>
          <span v-if="item.reportedAt">Reported {{ date(item.reportedAt) }}</span>
          <span v-if="item.releasedAt" class="text-success"
            >Report released {{ date(item.releasedAt) }}</span
          >
          <span v-if="item.resultsAvailable" class="text-success">
            {{ item.releasedResultCount }} result{{ item.releasedResultCount === 1 ? '' : 's' }}
            released
          </span>
          <span class="ml-auto flex items-center gap-1 text-accent">
            Open <AppIcon name="arrow-right" :size="11" />
          </span>
        </div>
      </NuxtLink>
    </div>

    <div v-if="totalPages > 1" class="mt-4 flex items-center justify-between">
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="page <= 1"
        @click="previous"
      >
        <AppIcon name="arrow-left" :size="12" /> Previous
      </button>
      <span class="font-mono text-[9px] uppercase tracking-caps text-muted"
        >Page {{ page }} of {{ totalPages }}</span
      >
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="page >= totalPages"
        @click="next"
      >
        Next <AppIcon name="arrow-right" :size="12" />
      </button>
    </div>
  </div>
</template>
