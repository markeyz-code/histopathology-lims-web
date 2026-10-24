<script setup lang="ts">
import type { CumulativeReport, Discipline } from '@lims/shared';
import { DISCIPLINE_LABELS, RESULT_FLAG_LABELS, RESULT_STATUS_LABELS } from '@lims/shared';

definePageMeta({ title: 'Cumulative report', capabilities: ['cases'] });
useHead({ title: 'Cumulative report' });

const route = useRoute();
const api = useApi();
const documents = useDocuments();
const { dateTime, name } = useFormat();
const pdfSaving = ref(false);
const patientId = computed(() => String(route.params.id));
const report = ref<CumulativeReport | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const from = ref('');
const to = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const params: Record<string, string> = {};
    if (from.value) params.from = from.value;
    if (to.value) params.to = to.value;
    report.value = await api.get<CumulativeReport>(
      `/results/cumulative/${patientId.value}`,
      params,
    );
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function flagClass(flag: string): string {
  if (flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH')
    return 'border-danger/50 bg-danger/[0.08] text-danger';
  if (flag === 'LOW' || flag === 'HIGH') return 'border-warning/50 bg-warning/[0.08] text-warning';
  return 'border-line bg-canvas text-muted';
}

function disciplineLabel(discipline: Discipline): string {
  return DISCIPLINE_LABELS[discipline];
}

function printReport(): void {
  window.print();
}

async function downloadPdf(): Promise<void> {
  pdfSaving.value = true;
  try {
    await documents.download(
      `/results/cumulative/${patientId.value}/pdf`,
      `${report.value?.patient.mrn ?? 'cumulative'}-cumulative.pdf`,
    );
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    pdfSaving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Patient record"
      title="Cumulative laboratory report"
      :description="
        report
          ? `${name(report.patient.firstName, report.patient.lastName)} · ${report.patient.mrn}`
          : 'Cross-discipline verified results'
      "
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="pdfSaving" @click="downloadPdf">
          <AppIcon name="download" :size="13" /> PDF
        </button>
        <button type="button" class="btn btn-secondary" @click="printReport()">
          <AppIcon name="file" :size="13" /> Print
        </button>
      </template>
      <template #meta>
        <span v-if="report">{{ report.results.length }} tests</span>
        <span v-if="report">{{ report.disciplines.length }} disciplines</span>
      </template>
    </PageHeader>

    <div class="panel mb-4 flex flex-wrap items-end gap-3 p-4 print:hidden">
      <FormField label="From" for-id="cumulative-from"
        ><input id="cumulative-from" v-model="from" type="date" class="input"
      /></FormField>
      <FormField label="To" for-id="cumulative-to"
        ><input id="cumulative-to" v-model="to" type="date" class="input"
      /></FormField>
      <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
        Apply
      </button>
      <NuxtLink
        v-if="report"
        :to="`/cases/${report.results[0]?.latest.caseId ?? ''}`"
        class="btn btn-ghost"
        >Back to case</NuxtLink
      >
    </div>

    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="8" />
    <template v-else-if="report">
      <section v-if="report.results.length === 0" class="panel p-8 text-sm text-muted">
        No verified or released results exist for this patient.
      </section>
      <div v-else class="space-y-5">
        <section
          v-for="group in report.results"
          :key="`${group.discipline}-${group.testCode}`"
          class="panel"
        >
          <div
            class="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4"
          >
            <div>
              <p class="label-caps">{{ disciplineLabel(group.discipline) }}</p>
              <h2 class="mt-1 display text-xl">{{ group.testName }}</h2>
              <p class="mt-1 text-xs text-muted">
                {{ group.history.length }} verified result{{
                  group.history.length === 1 ? '' : 's'
                }}
                · latest {{ dateTime(group.latest.createdAt) }}
              </p>
            </div>
            <span
              class="font-mono text-[9px] uppercase tracking-wide2"
              :class="group.latest.status === 'RELEASED' ? 'text-success' : 'text-accent'"
            >
              {{ RESULT_STATUS_LABELS[group.latest.status] }}
            </span>
          </div>
          <div class="overflow-x-auto">
            <table class="data-table mobile-cards">
              <thead>
                <tr>
                  <th>Analyte</th>
                  <th>Latest</th>
                  <th>Reference</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="value in group.latest.values" :key="value.analyteKey">
                  <td data-label="Analyte" class="text-sm">
                    {{ value.analyteName ?? value.analyteKey }}
                  </td>
                  <td data-label="Latest" class="mono text-sm">
                    {{ value.value ?? '—' }}
                    <span class="text-[10px] text-muted">{{ value.unit }}</span>
                  </td>
                  <td data-label="Reference" class="text-xs text-muted">
                    {{ value.referenceText ?? '—' }}
                  </td>
                  <td data-label="Flag">
                    <span
                      class="inline-flex border px-2 py-1 font-mono text-[9px] uppercase tracking-wide2"
                      :class="flagClass(value.flag)"
                      >{{ RESULT_FLAG_LABELS[value.flag] }}</span
                    >
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="group.history.length > 1" class="border-t border-line px-5 py-3">
            <p class="label-caps">Earlier results</p>
            <p
              v-for="history in group.history.slice(1)"
              :key="history.id"
              class="mt-1 text-[11px] text-muted"
            >
              {{ dateTime(history.createdAt) }} · v{{ history.currentVersion }} ·
              {{
                history.values
                  .map((value) => `${value.analyteKey} ${value.value ?? '—'}`)
                  .join(' · ')
              }}
            </p>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
