<script setup lang="ts">
import type { VerifyReportResult } from '@lims/shared';

definePageMeta({ layout: 'auth', title: 'Verify report' });
useHead({ title: 'Verify report' });

const route = useRoute();
const config = useRuntimeConfig();
const { dateTime } = useFormat();

const code = computed(() => String(route.params.code ?? '').toUpperCase());
const result = ref<VerifyReportResult | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    result.value = await $fetch<VerifyReportResult>(
      `${String(config.public.apiBase).replace(/\/$/, '')}/reports/verify/${encodeURIComponent(code.value)}`,
    );
  } catch (caught) {
    result.value = null;
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="mb-7">
      <p class="label-caps mb-3 flex items-center gap-2">
        <span class="h-1.5 w-1.5 bg-accent" />
        Report verification
      </p>
      <h1 class="display text-4xl leading-tight">Authenticity check.</h1>
      <p class="mt-3 text-sm leading-relaxed text-muted">
        This page confirms whether a histopathology report was electronically signed by the issuing
        laboratory.
      </p>
    </div>

    <div v-if="loading" class="border border-line bg-surface p-6">
      <div class="h-3 w-24 animate-pulse bg-line/60" />
      <div class="mt-4 h-7 w-48 animate-pulse bg-line/50" />
      <div class="mt-4 h-3 w-full animate-pulse bg-line/40" />
      <div class="mt-2 h-3 w-2/3 animate-pulse bg-line/40" />
    </div>

    <div v-else-if="result" class="border border-success/40">
      <div class="flex items-start gap-3 border-b border-success/30 bg-success/[0.07] p-5">
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center border border-success/40 bg-success/10 text-success"
        >
          <AppIcon name="shield" :size="21" />
        </span>
        <div>
          <p class="font-mono text-2xs uppercase tracking-caps text-success">Verified</p>
          <h2 class="display mt-1 text-2xl">Signed report</h2>
          <p class="mt-1 text-xs text-muted">{{ result.labName }} · {{ result.labCode }}</p>
        </div>
      </div>
      <dl class="divide-y divide-line">
        <div class="flex justify-between gap-4 px-5 py-3 text-sm">
          <dt class="text-muted">Accession</dt>
          <dd class="mono">{{ result.accessionNumber }}</dd>
        </div>
        <div class="flex justify-between gap-4 px-5 py-3 text-sm">
          <dt class="text-muted">Patient</dt>
          <dd class="mono">{{ result.patientInitials }}</dd>
        </div>
        <div class="flex justify-between gap-4 px-5 py-3 text-sm">
          <dt class="text-muted">Status</dt>
          <dd><StatusChip :status="result.status" kind="report" size="sm" /></dd>
        </div>
        <div class="flex justify-between gap-4 px-5 py-3 text-sm">
          <dt class="text-muted">Signed</dt>
          <dd class="mono text-right">{{ dateTime(result.signedOutAt) }}</dd>
        </div>
        <div class="flex justify-between gap-4 px-5 py-3 text-sm">
          <dt class="text-muted">Pathologist</dt>
          <dd class="text-right">{{ result.pathologistName ?? '—' }}</dd>
        </div>
        <div class="flex justify-between gap-4 px-5 py-3 text-sm">
          <dt class="text-muted">Code</dt>
          <dd class="mono">{{ result.verificationCode }}</dd>
        </div>
      </dl>
      <div class="border-t border-line bg-canvas/60 px-5 py-3">
        <p class="font-mono text-[9px] uppercase leading-relaxed tracking-wide2 text-muted">
          Verification confirms the report exists and is signed. It does not replace the full report
          or clinical judgement.
        </p>
      </div>
    </div>

    <div v-else class="border border-danger/40 bg-danger/[0.04] p-5" role="alert">
      <div class="flex items-start gap-3">
        <AppIcon name="alert" :size="20" class="mt-0.5 shrink-0 text-danger" />
        <div>
          <p class="font-mono text-2xs uppercase tracking-caps text-danger">Not verified</p>
          <p class="mt-1 text-sm leading-relaxed text-ink">
            {{ error ?? 'No signed report matches this verification code.' }}
          </p>
          <p class="mt-2 font-mono text-[9px] uppercase tracking-wide2 text-muted">
            Check the code printed under the QR on the report, or contact the issuing laboratory.
          </p>
        </div>
      </div>
    </div>

    <div class="mt-6 flex items-center justify-between gap-3">
      <NuxtLink to="/verify" class="btn btn-secondary btn-sm">Check another code</NuxtLink>
      <button type="button" class="btn btn-ghost btn-sm" @click="load">
        <AppIcon name="refresh" :size="12" /> Re-check
      </button>
    </div>
  </div>
</template>
