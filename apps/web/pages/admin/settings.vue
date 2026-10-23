<script setup lang="ts">
import type { Lab } from '@lims/shared';
import { formatAccession, validateAccessionFormat } from '@lims/shared';

definePageMeta({ title: 'Lab settings', capabilities: ['admin'] });
useHead({ title: 'Laboratory settings' });

const api = useApi();
const auth = useAuthStore();
const toast = useToast();

const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const formError = ref<string | null>(null);
const savedAt = ref<Date | null>(null);

const form = reactive({
  name: '',
  address: '',
  phone: '',
  email: '',
  accessionPrefix: '',
  accessionFormat: '{PREFIX}-{YYYY}-{SEQ:6}',
  tatWarningPercent: 80,
  FROZEN: 1,
  URGENT: 24,
  ROUTINE: 72,
  qaSamplingPercent: 15,
  currency: 'NGN',
  timezone: 'Africa/Lagos',
  letterheadPhone: '',
  letterheadEmail: '',
  website: '',
  pathologistName: '',
  pathologistTitle: '',
  qualifications: '',
  signatureText: '',
  footerNote: '',
});

const accessionProblem = computed(() => validateAccessionFormat(form.accessionFormat));
const accessionPreview = computed(() => {
  if (accessionProblem.value) return 'Invalid format';
  return formatAccession(form.accessionFormat, {
    prefix: form.accessionPrefix || 'HP',
    year: new Date().getFullYear(),
    sequence: 123,
  });
});

function applyLab(lab: Lab): void {
  form.name = lab.name;
  form.address = lab.address ?? '';
  form.phone = lab.phone ?? '';
  form.email = lab.email ?? '';
  form.accessionPrefix = lab.accessionPrefix;
  form.accessionFormat = lab.accessionFormat;
  form.tatWarningPercent = lab.tatWarningPercent;
  form.FROZEN = lab.tatHours.FROZEN;
  form.URGENT = lab.tatHours.URGENT;
  form.ROUTINE = lab.tatHours.ROUTINE;
  form.qaSamplingPercent = lab.qaSamplingPercent;
  form.currency = lab.currency;
  form.timezone = lab.timezone;
  form.letterheadPhone = lab.letterhead.phone ?? '';
  form.letterheadEmail = lab.letterhead.email ?? '';
  form.website = lab.letterhead.website ?? '';
  form.pathologistName = lab.letterhead.pathologistName ?? '';
  form.pathologistTitle = lab.letterhead.pathologistTitle ?? '';
  form.qualifications = lab.letterhead.qualifications ?? '';
  form.signatureText = lab.letterhead.signatureText ?? '';
  form.footerNote = lab.letterhead.footerNote ?? '';
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const lab = await api.get<Lab>('/labs/me');
    applyLab(lab);
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function save(): Promise<void> {
  formError.value = null;
  if (accessionProblem.value) {
    formError.value = accessionProblem.value;
    return;
  }
  saving.value = true;
  try {
    const lab = await api.patch<Lab>('/labs/me', {
      name: form.name,
      address: form.address,
      phone: form.phone,
      email: form.email || undefined,
      accessionPrefix: form.accessionPrefix,
      accessionFormat: form.accessionFormat,
      tatWarningPercent: form.tatWarningPercent,
      tatHours: { FROZEN: form.FROZEN, URGENT: form.URGENT, ROUTINE: form.ROUTINE },
      qaSamplingPercent: form.qaSamplingPercent,
      currency: form.currency,
      timezone: form.timezone,
      letterhead: {
        phone: form.letterheadPhone,
        email: form.letterheadEmail || undefined,
        website: form.website,
        pathologistName: form.pathologistName,
        pathologistTitle: form.pathologistTitle,
        qualifications: form.qualifications,
        signatureText: form.signatureText,
        footerNote: form.footerNote,
      },
    });
    applyLab(lab);
    if (auth.lab) auth.lab = lab;
    savedAt.value = new Date();
    toast.success('Settings saved', 'New accessions use these rules immediately.');
  } catch (caught) {
    formError.value = apiErrorMessage(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="Laboratory settings"
      description="Identity, accession numbering, turnaround windows and the letterhead used on every PDF report."
    >
      <template #actions>
        <button type="button" class="btn btn-primary" :disabled="saving || loading" @click="save">
          <AppIcon v-if="saving" name="refresh" :size="13" class="animate-spin" />
          <AppIcon v-else name="save" :size="13" />
          Save settings
        </button>
      </template>
      <template #meta>
        <span v-if="savedAt"
          >Saved
          {{ savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }}</span
        >
        <span class="mono">{{ auth.lab?.code }}</span>
      </template>
    </PageHeader>

    <AdminNav />

    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="6" />

    <form v-else class="space-y-5" novalidate @submit.prevent="save">
      <div
        v-if="formError"
        class="border border-danger/40 bg-danger/[0.05] p-3.5 text-sm text-danger"
        role="alert"
      >
        {{ formError }}
      </div>

      <section class="panel">
        <div class="border-b border-line px-5 py-4 sm:px-6">
          <h2 class="label-caps">Identity</h2>
          <p class="mt-1 text-xs text-muted">Printed on labels and the PDF letterhead.</p>
        </div>
        <div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <div class="sm:col-span-2">
            <FormField label="Laboratory name" for-id="lab-name" required>
              <input id="lab-name" v-model="form.name" class="input" />
            </FormField>
          </div>
          <div class="sm:col-span-2">
            <FormField label="Address" for-id="lab-address">
              <input id="lab-address" v-model="form.address" class="input" />
            </FormField>
          </div>
          <FormField label="Phone" for-id="lab-phone">
            <input id="lab-phone" v-model="form.phone" class="input" />
          </FormField>
          <FormField label="Email" for-id="lab-email">
            <input id="lab-email" v-model="form.email" type="email" class="input" />
          </FormField>
          <FormField label="Timezone" for-id="lab-timezone">
            <input
              id="lab-timezone"
              v-model="form.timezone"
              class="input mono"
              placeholder="Africa/Lagos"
            />
          </FormField>
          <div class="border border-line bg-canvas p-4">
            <p class="label-caps">Accession preview</p>
            <p class="mono mt-2 text-xl">{{ accessionPreview }}</p>
            <p class="mt-1 text-[11px] text-muted">Next number in sequence</p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="border-b border-line px-5 py-4 sm:px-6">
          <h2 class="label-caps">Accession numbering</h2>
          <p class="mt-1 text-xs text-muted">
            The format must include {SEQ} or {SEQ:n}. Tokens: PREFIX, YYYY, YY, SEQ.
          </p>
        </div>
        <div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <FormField label="Prefix" for-id="accession-prefix" required>
            <input
              id="accession-prefix"
              v-model="form.accessionPrefix"
              class="input mono uppercase"
              maxlength="6"
            />
          </FormField>
          <FormField label="Format" for-id="accession-format" required :error="accessionProblem">
            <input id="accession-format" v-model="form.accessionFormat" class="input mono" />
          </FormField>
          <div class="sm:col-span-2 border border-line bg-canvas p-4 text-xs">
            <p class="label-caps">Example</p>
            <p class="mono mt-2 text-lg text-accent">{{ accessionPreview }}</p>
            <p class="mt-2 text-muted">
              Sequence widths of 1–10 are supported, e.g. <span class="mono">{SEQ:6}</span>.
            </p>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="border-b border-line px-5 py-4 sm:px-6">
          <h2 class="label-caps">Turnaround windows</h2>
          <p class="mt-1 text-xs text-muted">
            Hours from receipt. The warning fires before the breach, at the configured percentage.
          </p>
        </div>
        <div class="grid gap-4 p-5 sm:grid-cols-4 sm:p-6">
          <FormField label="Frozen (h)" for-id="tat-frozen">
            <input
              id="tat-frozen"
              v-model.number="form.FROZEN"
              type="number"
              min="0.25"
              step="0.25"
              class="input"
            />
          </FormField>
          <FormField label="Urgent (h)" for-id="tat-urgent">
            <input
              id="tat-urgent"
              v-model.number="form.URGENT"
              type="number"
              min="0.5"
              step="0.5"
              class="input"
            />
          </FormField>
          <FormField label="Routine (h)" for-id="tat-routine">
            <input
              id="tat-routine"
              v-model.number="form.ROUTINE"
              type="number"
              min="1"
              class="input"
            />
          </FormField>
          <FormField label="Warning at (%)" for-id="tat-warning">
            <input
              id="tat-warning"
              v-model.number="form.tatWarningPercent"
              type="number"
              min="50"
              max="95"
              class="input"
            />
          </FormField>
        </div>
      </section>

      <section class="panel">
        <div class="border-b border-line px-5 py-4 sm:px-6">
          <h2 class="label-caps">Quality &amp; billing</h2>
          <p class="mt-1 text-xs text-muted">
            Automatic peer-review sampling and the currency used for new invoices.
          </p>
        </div>
        <div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <FormField label="Peer-review sampling (%)" for-id="qa-sampling">
            <input
              id="qa-sampling"
              v-model.number="form.qaSamplingPercent"
              type="number"
              min="0"
              max="100"
              class="input"
            />
          </FormField>
          <FormField label="Billing currency" for-id="lab-currency">
            <input
              id="lab-currency"
              v-model="form.currency"
              maxlength="3"
              class="input font-mono uppercase"
            />
          </FormField>
        </div>
      </section>

      <section class="panel">
        <div class="border-b border-line px-5 py-4 sm:px-6">
          <h2 class="label-caps">Report letterhead</h2>
          <p class="mt-1 text-xs text-muted">
            These values appear in the footer and signature block of every PDF.
          </p>
        </div>
        <div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <FormField label="Letterhead phone" for-id="lh-phone">
            <input id="lh-phone" v-model="form.letterheadPhone" class="input" />
          </FormField>
          <FormField label="Letterhead email" for-id="lh-email">
            <input id="lh-email" v-model="form.letterheadEmail" type="email" class="input" />
          </FormField>
          <FormField label="Website" for-id="lh-website">
            <input id="lh-website" v-model="form.website" class="input" />
          </FormField>
          <FormField label="Lead pathologist" for-id="lh-pathologist">
            <input id="lh-pathologist" v-model="form.pathologistName" class="input" />
          </FormField>
          <FormField label="Title" for-id="lh-title">
            <input
              id="lh-title"
              v-model="form.pathologistTitle"
              class="input"
              placeholder="Consultant Histopathologist"
            />
          </FormField>
          <FormField label="Qualifications" for-id="lh-qualifications">
            <input
              id="lh-qualifications"
              v-model="form.qualifications"
              class="input"
              placeholder="MBBS, FMCPath"
            />
          </FormField>
          <div class="sm:col-span-2">
            <FormField label="Signature statement" for-id="lh-signature">
              <input id="lh-signature" v-model="form.signatureText" class="input" />
            </FormField>
          </div>
          <div class="sm:col-span-2">
            <FormField label="Footer note" for-id="lh-footer">
              <textarea id="lh-footer" v-model="form.footerNote" class="textarea min-h-[70px]" />
            </FormField>
          </div>
        </div>
      </section>

      <div
        class="sticky bottom-0 z-20 flex flex-col items-stretch justify-between gap-3 border-t border-line bg-canvas/95 py-3 backdrop-blur-sm sm:flex-row sm:items-center"
      >
        <p class="font-mono text-[9px] uppercase tracking-wide2 text-muted">
          <AppIcon name="shield" :size="11" class="mr-1 inline" />
          Changes are audited with before and after values.
        </p>
        <button type="submit" class="btn btn-primary" :disabled="saving">
          <AppIcon name="save" :size="13" /> Save settings
        </button>
      </div>
    </form>
  </div>
</template>
