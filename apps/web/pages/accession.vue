<script setup lang="ts">
import type {
  AccessionInput,
  CaseDetail,
  Discipline,
  Laterality,
  Priority,
  Sex,
  UserSummary,
} from '@lims/shared';
import {
  LATERALITIES,
  LATERALITY_LABELS,
  DISCIPLINE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  SEXES,
  SEX_LABELS,
  SPECIMEN_TYPE_PRESETS,
  SUBSPECIALTIES,
  accessionSchema,
} from '@lims/shared';

definePageMeta({ title: 'Accession', capabilities: ['accession'] });
useHead({ title: 'New accession' });

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const documents = useDocuments();
const { date } = useFormat();

const loading = ref(false);
const error = ref<string | null>(null);
const fieldErrors = reactive<Record<string, string>>({});
const result = ref<CaseDetail | null>(null);
const pathologists = ref<UserSummary[]>([]);
const formTop = ref<HTMLElement | null>(null);

interface SpecimenRow {
  specimenType: string;
  site: string;
  laterality: Laterality;
  description: string;
  collectedAt: string;
}

const form = reactive({
  mrn: '',
  firstName: '',
  lastName: '',
  sex: 'UNKNOWN' as Sex,
  dateOfBirth: '',
  age: '',
  phone: '',
  email: '',
  address: '',
  nationalId: '',
  clinicianName: '',
  clinicianFacility: '',
  clinicianPhone: '',
  clinicianEmail: '',
  clinicalHistory: '',
  clinicalDiagnosis: '',
  priority: 'ROUTINE' as Priority,
  discipline: 'HISTOPATHOLOGY' as Discipline,
  subspecialty: '',
  assignedPathologistId: '',
  specimens: [
    {
      specimenType: 'Core biopsy',
      site: '',
      laterality: 'NOT_APPLICABLE' as Laterality,
      description: '',
      collectedAt: '',
    },
  ] as SpecimenRow[],
});

const priorityCopy: Record<Priority, string> = {
  ROUTINE: 'Standard histology pathway. Report within the routine window.',
  URGENT: 'Clinically time-sensitive. Escalated on the worklist.',
  FROZEN: 'Frozen section or immediate intra-operative diagnosis.',
};

const priorityIcon: Record<Priority, 'clock' | 'alert' | 'microscope'> = {
  ROUTINE: 'clock',
  URGENT: 'alert',
  FROZEN: 'microscope',
};

function addSpecimen(): void {
  form.specimens.push({
    specimenType: 'Core biopsy',
    site: '',
    laterality: 'NOT_APPLICABLE',
    description: '',
    collectedAt: '',
  });
}

function removeSpecimen(index: number): void {
  if (form.specimens.length <= 1) return;
  form.specimens.splice(index, 1);
}

function clearErrors(): void {
  error.value = null;
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
}

function errorFor(key: string): string | null {
  return fieldErrors[key] ?? null;
}

function buildPayload(): AccessionInput {
  return {
    patient: {
      mrn: form.mrn.trim() || undefined,
      firstName: form.firstName,
      lastName: form.lastName,
      sex: form.sex,
      dateOfBirth: form.dateOfBirth || undefined,
      age: form.age === '' ? undefined : Number(form.age),
      phone: form.phone || undefined,
      email: form.email || undefined,
      address: form.address || undefined,
      nationalId: form.nationalId || undefined,
    },
    referringClinician: {
      name: form.clinicianName,
      facility: form.clinicianFacility || undefined,
      phone: form.clinicianPhone || undefined,
      email: form.clinicianEmail || undefined,
    },
    clinicalHistory: form.clinicalHistory,
    clinicalDiagnosis: form.clinicalDiagnosis || undefined,
    priority: form.priority,
    discipline: form.discipline,
    subspecialty: form.subspecialty || undefined,
    assignedPathologistId: form.assignedPathologistId || undefined,
    specimens: form.specimens.map((specimen) => ({
      specimenType: specimen.specimenType,
      site: specimen.site,
      laterality: specimen.laterality,
      description: specimen.description || undefined,
      collectedAt: specimen.collectedAt ? new Date(specimen.collectedAt).toISOString() : undefined,
    })),
  };
}

async function submit(): Promise<void> {
  clearErrors();
  const parsed = accessionSchema.safeParse(buildPayload());
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    const firstKey = parsed.error.issues[0]?.path.join('.') ?? '';
    await nextTick();
    document
      .querySelector<HTMLElement>(`[data-field="${firstKey}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector<HTMLInputElement>(`[data-field="${firstKey}"] input`)?.focus();
    return;
  }

  loading.value = true;
  try {
    result.value = await api.post<CaseDetail>('/cases/accession', parsed.data);
    toast.success('Case accessioned', result.value.accessionNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function resetForm(): void {
  result.value = null;
  clearErrors();
  form.mrn = '';
  form.firstName = '';
  form.lastName = '';
  form.sex = 'UNKNOWN';
  form.dateOfBirth = '';
  form.age = '';
  form.phone = '';
  form.email = '';
  form.address = '';
  form.nationalId = '';
  form.clinicianName = '';
  form.clinicianFacility = '';
  form.clinicianPhone = '';
  form.clinicianEmail = '';
  form.clinicalHistory = '';
  form.clinicalDiagnosis = '';
  form.priority = 'ROUTINE';
  form.subspecialty = '';
  form.assignedPathologistId = '';
  form.specimens = [
    {
      specimenType: 'Core biopsy',
      site: '',
      laterality: 'NOT_APPLICABLE',
      description: '',
      collectedAt: '',
    },
  ];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function printSpecimens(): Promise<void> {
  if (!result.value) return;
  try {
    await documents.openCaseLabels(result.value.id, 'specimens');
  } catch (caught) {
    toast.error('Labels unavailable', apiErrorMessage(caught));
  }
}

onMounted(async () => {
  try {
    pathologists.value = await api.get<UserSummary[]>('/users/pathologists');
  } catch {
    pathologists.value = [];
  }
});
</script>

<template>
  <div ref="formTop">
    <PageHeader
      eyebrow="Reception · Accessioning"
      title="Accession a new case"
      description="Register the patient, the referring clinician and every specimen. An accession number and barcoded labels are created in one transaction."
      back-to="/cases"
      back-label="Case register"
    >
      <template #meta>
        <span class="mono">{{ auth.lab?.code }} · {{ auth.lab?.accessionFormat }}</span>
        <span>MRN generated automatically if omitted</span>
      </template>
    </PageHeader>

    <template v-if="result">
      <section class="panel border-success/40">
        <div class="border-b border-line bg-success/[0.05] px-5 py-6 sm:px-7">
          <div class="flex items-start gap-4">
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center border border-success/40 bg-success/10 text-success"
            >
              <AppIcon name="check" :size="22" />
            </span>
            <div>
              <p class="label-caps text-success">Accessioned</p>
              <h2 class="display mt-1 text-3xl">{{ result.accessionNumber }}</h2>
              <p class="mt-1.5 text-sm text-muted">
                {{ result.patient.firstName }} {{ result.patient.lastName }} · MRN
                <span class="mono">{{ result.patient.mrn }}</span> · received
                {{ date(result.receivedAt) }}
              </p>
            </div>
          </div>
        </div>
        <div class="grid gap-6 p-5 sm:p-7 lg:grid-cols-2">
          <div>
            <h3 class="label-caps">Specimens &amp; labels</h3>
            <div class="mt-3 divide-y divide-line border border-line">
              <div
                v-for="specimen in result.specimens"
                :key="specimen.id"
                class="flex items-center gap-3 px-3.5 py-3"
              >
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-canvas font-display text-lg"
                >
                  {{ specimen.label }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ specimen.specimenType }}</p>
                  <p class="truncate text-xs text-muted">{{ specimen.site }}</p>
                  <p class="mono mt-0.5 text-[10px] text-muted">{{ specimen.barcode }}</p>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  @click="
                    documents
                      .openLabel('specimen', specimen.id)
                      .catch((e) => toast.error('Label unavailable', apiErrorMessage(e)))
                  "
                >
                  <AppIcon name="print" :size="12" /> Label
                </button>
              </div>
            </div>
            <button type="button" class="btn btn-secondary mt-3 w-full" @click="printSpecimens">
              <AppIcon name="print" :size="13" /> Print specimen labels (PDF)
            </button>
          </div>
          <div>
            <h3 class="label-caps">Next actions</h3>
            <div class="mt-3 space-y-2">
              <NuxtLink :to="`/cases/${result.id}`" class="btn btn-primary w-full justify-start">
                <AppIcon name="cases" :size="14" /> Open case detail &amp; timeline
              </NuxtLink>
              <NuxtLink
                v-if="auth.can('grossing')"
                :to="`/scan/grossing`"
                class="btn btn-secondary w-full justify-start"
              >
                <AppIcon name="scan" :size="14" /> Go to grossing scan station
              </NuxtLink>
              <button
                type="button"
                class="btn btn-secondary w-full justify-start"
                @click="resetForm"
              >
                <AppIcon name="plus" :size="14" /> Accession another case
              </button>
            </div>
            <div class="mt-5 border border-line bg-canvas p-3.5">
              <p class="label-caps">What happens next</p>
              <ol class="mt-2 space-y-1.5 text-xs text-muted">
                <li><span class="mono text-ink">01</span> Specimens move to grossing</li>
                <li><span class="mono text-ink">02</span> Cassettes are created and barcoded</li>
                <li>
                  <span class="mono text-ink">03</span> Every station is a scan and an immutable
                  event
                </li>
              </ol>
            </div>
          </div>
        </div>
      </section>
    </template>

    <form v-else class="space-y-5" novalidate @submit.prevent="submit">
      <div v-if="error" class="border border-danger/40 bg-danger/[0.05] p-4 text-sm" role="alert">
        <span class="font-mono text-2xs uppercase tracking-caps text-danger">Accession failed</span>
        <p class="mt-1 text-ink">{{ error }}</p>
      </div>

      <section class="panel">
        <div class="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
          <span class="display text-2xl leading-none text-accent">01</span>
          <div>
            <h2 class="display text-xl">Patient</h2>
            <p class="mt-1 text-xs text-muted">
              Use the existing MRN when available; otherwise one is generated.
            </p>
          </div>
        </div>
        <div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <div data-field="patient.firstName">
            <FormField
              label="First name"
              for-id="first-name"
              required
              :error="errorFor('patient.firstName')"
            >
              <input
                id="first-name"
                v-model="form.firstName"
                class="input"
                autocomplete="given-name"
                placeholder="Ngozi"
              />
            </FormField>
          </div>
          <div data-field="patient.lastName">
            <FormField
              label="Surname"
              for-id="last-name"
              required
              :error="errorFor('patient.lastName')"
            >
              <input
                id="last-name"
                v-model="form.lastName"
                class="input"
                autocomplete="family-name"
                placeholder="Eze"
              />
            </FormField>
          </div>
          <FormField label="Sex" for-id="sex" required :error="errorFor('patient.sex')">
            <select id="sex" v-model="form.sex" class="select">
              <option v-for="sex in SEXES" :key="sex" :value="sex">{{ SEX_LABELS[sex] }}</option>
            </select>
          </FormField>
          <FormField label="Date of birth" for-id="dob" :error="errorFor('patient.dateOfBirth')">
            <input id="dob" v-model="form.dateOfBirth" type="date" class="input" />
          </FormField>
          <FormField
            label="Age"
            for-id="age"
            hint="Use age when date of birth is unavailable."
            :error="errorFor('patient.age')"
          >
            <input
              id="age"
              v-model="form.age"
              type="number"
              min="0"
              max="130"
              class="input"
              placeholder="44"
            />
          </FormField>
          <FormField
            label="MRN"
            for-id="mrn"
            hint="Optional. Auto-generated if blank."
            :error="errorFor('patient.mrn')"
          >
            <input
              id="mrn"
              v-model="form.mrn"
              class="input mono uppercase"
              placeholder="MRN-2026-00031"
            />
          </FormField>
          <FormField label="Phone" for-id="phone" :error="errorFor('patient.phone')">
            <input
              id="phone"
              v-model="form.phone"
              type="tel"
              class="input"
              autocomplete="tel"
              placeholder="+234 803 000 0000"
            />
          </FormField>
          <FormField label="Email" for-id="patient-email" :error="errorFor('patient.email')">
            <input
              id="patient-email"
              v-model="form.email"
              type="email"
              class="input"
              autocomplete="email"
              placeholder="patient@example.com"
            />
          </FormField>
          <FormField
            label="National ID"
            for-id="national-id"
            optional
            :error="errorFor('patient.nationalId')"
          >
            <input
              id="national-id"
              v-model="form.nationalId"
              class="input"
              placeholder="NIN or hospital ID"
            />
          </FormField>
          <div class="sm:col-span-2 lg:col-span-3">
            <FormField
              label="Address"
              for-id="address"
              optional
              :error="errorFor('patient.address')"
            >
              <input
                id="address"
                v-model="form.address"
                class="input"
                autocomplete="street-address"
                placeholder="Ikeja, Lagos"
              />
            </FormField>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
          <span class="display text-2xl leading-none text-accent">02</span>
          <div>
            <h2 class="display text-xl">Referral &amp; priority</h2>
            <p class="mt-1 text-xs text-muted">Priority sets the turnaround window immediately.</p>
          </div>
        </div>
        <div class="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <div data-field="referringClinician.name">
            <FormField
              label="Referring clinician"
              for-id="clinician"
              required
              :error="errorFor('referringClinician.name')"
            >
              <input
                id="clinician"
                v-model="form.clinicianName"
                class="input"
                placeholder="Dr Bola Adeyemi"
              />
            </FormField>
          </div>
          <FormField
            label="Facility"
            for-id="clinician-facility"
            :error="errorFor('referringClinician.facility')"
          >
            <input
              id="clinician-facility"
              v-model="form.clinicianFacility"
              class="input"
              placeholder="St Mary's Clinic"
            />
          </FormField>
          <FormField
            label="Clinician phone"
            for-id="clinician-phone"
            :error="errorFor('referringClinician.phone')"
          >
            <input
              id="clinician-phone"
              v-model="form.clinicianPhone"
              type="tel"
              class="input"
              placeholder="+234 803 000 0000"
            />
          </FormField>
          <FormField
            label="Clinician email"
            for-id="clinician-email"
            :error="errorFor('referringClinician.email')"
          >
            <input
              id="clinician-email"
              v-model="form.clinicianEmail"
              type="email"
              class="input"
              placeholder="clinician@example.com"
            />
          </FormField>
          <FormField
            label="Discipline"
            for-id="accession-discipline"
            hint="Only disciplines enabled for this laboratory are listed."
          >
            <select id="accession-discipline" v-model="form.discipline" class="select">
              <option
                v-for="discipline in auth.lab?.enabledDisciplines ?? ['HISTOPATHOLOGY']"
                :key="discipline"
                :value="discipline"
              >
                {{ DISCIPLINE_LABELS[discipline] }}
              </option>
            </select>
          </FormField>
          <FormField label="Subspecialty" for-id="subspecialty" :error="errorFor('subspecialty')">
            <select id="subspecialty" v-model="form.subspecialty" class="select">
              <option value="">Unassigned</option>
              <option
                v-for="subspecialty in SUBSPECIALTIES"
                :key="subspecialty"
                :value="subspecialty"
              >
                {{ subspecialty }}
              </option>
            </select>
          </FormField>
          <FormField
            label="Assigned pathologist"
            for-id="assigned-pathologist"
            :error="errorFor('assignedPathologistId')"
          >
            <select id="assigned-pathologist" v-model="form.assignedPathologistId" class="select">
              <option value="">Leave unassigned</option>
              <option
                v-for="pathologist in pathologists"
                :key="pathologist.id"
                :value="pathologist.id"
              >
                {{ pathologist.name }}
              </option>
            </select>
          </FormField>
          <div class="sm:col-span-2 lg:col-span-3" data-field="clinicalHistory">
            <FormField
              label="Clinical history"
              for-id="clinical-history"
              required
              :error="errorFor('clinicalHistory')"
            >
              <textarea
                id="clinical-history"
                v-model="form.clinicalHistory"
                class="textarea min-h-[110px]"
                placeholder="Symptoms, duration, examination findings, imaging and previous treatment…"
              />
            </FormField>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <FormField
              label="Clinical diagnosis"
              for-id="clinical-diagnosis"
              optional
              :error="errorFor('clinicalDiagnosis')"
            >
              <input
                id="clinical-diagnosis"
                v-model="form.clinicalDiagnosis"
                class="input"
                placeholder="Suspected invasive carcinoma"
              />
            </FormField>
          </div>
          <div class="sm:col-span-2 lg:col-span-3">
            <p class="field-label">Priority <span class="text-accent">*</span></p>
            <div class="grid gap-2 sm:grid-cols-3">
              <button
                v-for="priority in PRIORITIES"
                :key="priority"
                type="button"
                class="border p-3.5 text-left transition-colors"
                :class="
                  form.priority === priority
                    ? 'border-accent bg-accent/[0.06]'
                    : 'border-line bg-raised hover:border-line-strong'
                "
                :aria-pressed="form.priority === priority"
                @click="form.priority = priority"
              >
                <span class="flex items-center justify-between gap-2">
                  <span
                    class="font-mono text-[10px] uppercase tracking-caps"
                    :class="form.priority === priority ? 'text-accent' : 'text-muted'"
                  >
                    {{ PRIORITY_LABELS[priority] }}
                  </span>
                  <AppIcon
                    :name="priorityIcon[priority]"
                    :size="15"
                    :class="form.priority === priority ? 'text-accent' : 'text-muted'"
                  />
                </span>
                <span class="mt-2 block text-xs leading-relaxed text-muted">{{
                  priorityCopy[priority]
                }}</span>
                <span class="mt-2 block font-mono text-[10px] text-ink">
                  {{ auth.lab?.tatHours[priority] ?? '—' }}h window
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
          <span class="display text-2xl leading-none text-accent">03</span>
          <div class="flex-1">
            <h2 class="display text-xl">Specimens</h2>
            <p class="mt-1 text-xs text-muted">Each specimen receives its own barcode and label.</p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" @click="addSpecimen">
            <AppIcon name="plus" :size="12" /> Add
          </button>
        </div>
        <div class="divide-y divide-line">
          <div v-for="(specimen, index) in form.specimens" :key="index" class="p-5 sm:p-6">
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="font-mono text-2xs uppercase tracking-caps text-muted">
                Specimen {{ String.fromCharCode(65 + index) }} · {{ index + 1 }} of
                {{ form.specimens.length }}
              </p>
              <button
                v-if="form.specimens.length > 1"
                type="button"
                class="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wide2 text-danger hover:underline"
                @click="removeSpecimen(index)"
              >
                <AppIcon name="trash" :size="12" /> Remove
              </button>
            </div>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                label="Specimen type"
                :for-id="`specimen-type-${index}`"
                required
                :error="errorFor(`specimens.${index}.specimenType`)"
              >
                <select
                  :id="`specimen-type-${index}`"
                  v-model="specimen.specimenType"
                  class="select"
                >
                  <option v-for="type in SPECIMEN_TYPE_PRESETS" :key="type" :value="type">
                    {{ type }}
                  </option>
                </select>
              </FormField>
              <div :data-field="`specimens.${index}.site`">
                <FormField
                  label="Anatomical site"
                  :for-id="`specimen-site-${index}`"
                  required
                  :error="errorFor(`specimens.${index}.site`)"
                >
                  <input
                    :id="`specimen-site-${index}`"
                    v-model="specimen.site"
                    class="input"
                    placeholder="Left breast, upper outer quadrant"
                  />
                </FormField>
              </div>
              <FormField
                label="Laterality"
                :for-id="`specimen-laterality-${index}`"
                :error="errorFor(`specimens.${index}.laterality`)"
              >
                <select
                  :id="`specimen-laterality-${index}`"
                  v-model="specimen.laterality"
                  class="select"
                >
                  <option v-for="laterality in LATERALITIES" :key="laterality" :value="laterality">
                    {{ LATERALITY_LABELS[laterality] }}
                  </option>
                </select>
              </FormField>
              <FormField
                label="Collected at"
                :for-id="`specimen-collected-${index}`"
                :error="errorFor(`specimens.${index}.collectedAt`)"
              >
                <input
                  :id="`specimen-collected-${index}`"
                  v-model="specimen.collectedAt"
                  type="datetime-local"
                  class="input"
                />
              </FormField>
              <div class="sm:col-span-2 lg:col-span-4">
                <FormField
                  label="Specimen description"
                  :for-id="`specimen-description-${index}`"
                  optional
                  :error="errorFor(`specimens.${index}.description`)"
                >
                  <input
                    :id="`specimen-description-${index}`"
                    v-model="specimen.description"
                    class="input"
                    placeholder="Container, fixative, number of cores or orientation"
                  />
                </FormField>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div
        class="sticky bottom-0 z-20 -mx-4 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-sm sm:mx-0 sm:px-0"
      >
        <div class="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
          <p class="font-mono text-[9px] uppercase tracking-wide2 text-muted">
            <AppIcon name="lock" :size="11" class="mr-1 inline" />
            Accessioning writes case, patient, specimens and custody events in one transaction
          </p>
          <div class="flex items-center gap-2">
            <NuxtLink to="/cases" class="btn btn-ghost">Cancel</NuxtLink>
            <button type="submit" class="btn btn-primary flex-1 sm:flex-none" :disabled="loading">
              <AppIcon v-if="loading" name="refresh" :size="13" class="animate-spin" />
              <AppIcon v-else name="check" :size="13" />
              {{ loading ? 'Accessioning…' : 'Accession case' }}
            </button>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>
