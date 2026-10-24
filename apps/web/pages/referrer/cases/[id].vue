<script setup lang="ts">
import type { PortalCaseDetail, PortalResultSummary } from '@lims/shared';
import { DISCIPLINE_LABELS } from '@lims/shared';

definePageMeta({ layout: 'portal', title: 'Referral detail' });
useHead({ title: 'Referral detail' });

const route = useRoute();
const api = useApi();
const documents = useDocuments();
const toast = useToast();
const { dateTime, date } = useFormat();
const detail = ref<PortalCaseDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const downloading = ref(false);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    detail.value = await api.get<PortalCaseDetail>(`/portal/cases/${route.params.id}`);
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function downloadResult(result: PortalResultSummary): Promise<void> {
  if (!detail.value) return;
  try {
    await documents.download(
      result.downloadUrl,
      `${detail.value.accessionNumber}-${result.testCode}.pdf`,
    );
  } catch (caught) {
    toast.error('Result could not be downloaded', apiErrorMessage(caught));
  }
}

async function download(): Promise<void> {
  if (!detail.value) return;
  downloading.value = true;
  try {
    await documents.download(
      `/portal/cases/${detail.value.id}/report.pdf`,
      `${detail.value.accessionNumber}.pdf`,
    );
  } catch (caught) {
    toast.error('Report could not be downloaded', apiErrorMessage(caught));
  } finally {
    downloading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <NuxtLink
      to="/referrer"
      class="mb-5 inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-caps text-muted hover:text-ink"
    >
      <AppIcon name="arrow-left" :size="12" /> All referrals
    </NuxtLink>

    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="8" />
    <div v-else-if="detail">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="label-caps mb-2">Referral file</p>
          <h1 class="display text-4xl tracking-tight">{{ detail.accessionNumber }}</h1>
          <p class="mt-2 text-sm text-muted">{{ detail.patientName }} · {{ detail.patientMrn }}</p>
        </div>
        <span
          class="border px-3 py-1.5 font-mono text-[10px] uppercase tracking-caps"
          :class="
            detail.reportAvailable
              ? 'border-success/40 bg-success/10 text-success'
              : 'border-line text-muted'
          "
        >
          {{ detail.reportAvailable ? 'Report released' : detail.referralStatus.replace('_', ' ') }}
        </span>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-3">
        <div class="space-y-4 lg:col-span-2">
          <section class="panel p-5">
            <h2 class="font-mono text-[10px] uppercase tracking-caps text-muted">
              Clinical request
            </h2>
            <dl class="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt class="label-caps">Received</dt>
                <dd class="mt-1 text-sm">{{ dateTime(detail.receivedAt) }}</dd>
              </div>
              <div>
                <dt class="label-caps">Priority</dt>
                <dd class="mt-1 text-sm">{{ detail.priority }}</dd>
              </div>
              <div>
                <dt class="label-caps">Specimen</dt>
                <dd class="mt-1 text-sm">Histopathology</dd>
              </div>
              <div>
                <dt class="label-caps">Reported</dt>
                <dd class="mt-1 text-sm">
                  {{ detail.reportedAt ? dateTime(detail.reportedAt) : 'In progress' }}
                </dd>
              </div>
            </dl>
            <div class="mt-5 border-t border-line pt-4">
              <p class="label-caps">Clinical history</p>
              <p class="mt-1.5 text-sm leading-relaxed text-ink">{{ detail.clinicalHistory }}</p>
              <p v-if="detail.clinicalDiagnosis" class="mt-2 text-xs text-muted">
                Clinical diagnosis: {{ detail.clinicalDiagnosis }}
              </p>
            </div>
          </section>

          <section v-if="detail.report" class="panel p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="font-mono text-[10px] uppercase tracking-caps text-success">
                  Released report
                </p>
                <h2 class="mt-1 text-xl">{{ detail.report.protocol.title }}</h2>
              </div>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                :disabled="downloading"
                @click="download"
              >
                <AppIcon name="download" :size="12" />
                {{ downloading ? 'Preparing…' : 'Download PDF' }}
              </button>
            </div>
            <div class="mt-5 border-t border-line pt-4">
              <p class="label-caps">Diagnosis</p>
              <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                {{ detail.report.narrative }}
              </p>
            </div>
            <div
              class="mt-4 flex flex-wrap gap-4 border-t border-line pt-3 font-mono text-[9px] uppercase tracking-caps text-muted"
            >
              <span
                >Signed
                {{ detail.report.signedOutAt ? date(detail.report.signedOutAt) : '—' }}</span
              >
              <span>Version {{ detail.report.version }}</span>
              <span v-if="detail.report.verificationCode"
                >Verify {{ detail.report.verificationCode }}</span
              >
            </div>
          </section>

          <section v-else class="panel border-dashed p-5">
            <p class="font-mono text-[10px] uppercase tracking-caps text-warning">
              Report not yet released
            </p>
            <p class="mt-2 text-sm leading-relaxed text-muted">
              The laboratory has not released this report to the portal yet. You will receive a
              notification when it is ready.
            </p>
          </section>

          <section v-if="detail.results.length > 0" class="panel p-5">
            <p class="label-caps">Released results</p>
            <div class="mt-3 divide-y divide-line border border-line">
              <button
                v-for="result in detail.results"
                :key="result.id"
                type="button"
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-raised"
                @click="downloadResult(result)"
              >
                <div>
                  <p class="text-sm font-medium">{{ result.testName }}</p>
                  <p class="mt-0.5 font-mono text-[9px] uppercase tracking-wide2 text-muted">
                    {{ DISCIPLINE_LABELS[result.discipline] }} · {{ result.testCode }} · released
                    {{ date(result.releasedAt) }}
                  </p>
                </div>
                <AppIcon name="download" :size="14" class="text-accent" />
              </button>
            </div>
          </section>
        </div>

        <div class="space-y-4">
          <section class="panel p-4">
            <h2 class="font-mono text-[10px] uppercase tracking-caps text-muted">Referrer</h2>
            <p class="mt-3 text-sm font-medium">{{ detail.referringClinician.name }}</p>
            <p class="mt-1 text-xs text-muted">{{ detail.referringClinician.facility ?? '—' }}</p>
            <p class="mt-2 text-xs text-muted">{{ detail.referringClinician.email ?? '' }}</p>
          </section>
          <section class="panel p-4">
            <h2 class="font-mono text-[10px] uppercase tracking-caps text-muted">Progress</h2>
            <ol class="scroll-area mt-4 max-h-[540px] space-y-3 overflow-y-auto pr-1">
              <li
                v-for="event in detail.timeline"
                :key="event.id"
                class="border-l border-line pl-3"
              >
                <p class="font-mono text-[9px] uppercase tracking-caps text-ink">
                  {{ event.eventType.replace('_', ' ') }}
                </p>
                <p class="mt-1 text-[11px] leading-relaxed text-muted">
                  {{ event.reason ?? event.station ?? '' }}
                </p>
                <p class="mt-1 font-mono text-[8px] text-muted">{{ dateTime(event.timestamp) }}</p>
              </li>
            </ol>
          </section>
          <NuxtLink to="/verify" class="btn btn-secondary w-full justify-start">
            <AppIcon name="qr" :size="13" /> Verify a report
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
