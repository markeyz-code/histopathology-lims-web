<script setup lang="ts">
import type { Block, CaseDetail, Slide, Specimen, StainType, UserSummary } from '@lims/shared';
import {
  DISCIPLINE_LABELS,
  PRIORITY_LABELS,
  REJECTION_REASON_CODES,
  REJECTION_REASON_LABELS,
  STAIN_TYPES,
  STAIN_TYPE_LABELS,
  TEST_REQUEST_STATUS_LABELS,
} from '@lims/shared';

definePageMeta({ title: 'Case detail', capabilities: ['cases'] });

const route = useRoute();
const auth = useAuthStore();
const casesApi = useCases();
const toast = useToast();
const documents = useDocuments();
const { date, dateTime, name, sex } = useFormat();

const caseId = computed(() => String(route.params.id));
const detail = ref<CaseDetail | null>(null);
useHead({ title: () => detail.value?.accessionNumber ?? 'Case detail' });
const loading = ref(true);
const error = ref<string | null>(null);
const refreshing = ref(false);
const pathologists = ref<UserSummary[]>([]);
const assignmentSelection = ref('');

const assignmentOptions = computed(() => [
  { value: '', label: 'Unassigned' },
  ...pathologists.value.map((person) => ({ value: person.id, label: person.name })),
]);
const stainOptions = STAIN_TYPES.map((value) => ({ value, label: STAIN_TYPE_LABELS[value] }));
const rejectionOptions = REJECTION_REASON_CODES.map((value) => ({
  value,
  label: REJECTION_REASON_LABELS[value],
}));
const stainTypeOptions = [
  { value: 'SPECIAL', label: 'Special stain' },
  { value: 'IMMUNOHISTOCHEMISTRY', label: 'Immunohistochemistry' },
];

const hasHistopathology = computed(
  () => detail.value?.disciplines.includes('HISTOPATHOLOGY') ?? false,
);
const canGross = computed(() => auth.can('grossing') && !isClosed.value && hasHistopathology.value);
const canCut = computed(() => auth.can('lab_work') && !isClosed.value && hasHistopathology.value);
const canReport = computed(() => auth.can('reports') && !isClosed.value && hasHistopathology.value);
const canOpenReport = computed(() => auth.can('reports') && hasHistopathology.value);
const canAdmin = computed(() => auth.can('admin'));
const isPathologist = computed(() => auth.role === 'PATHOLOGIST');
const isClosed = computed(
  () => detail.value?.status === 'REPORTED' || detail.value?.status === 'AMENDED',
);

const pdfOpen = ref(false);

const grossModal = ref(false);
const grossSpecimen = ref<Specimen | null>(null);
const grossDescription = ref('');
const grossBlockCount = ref(2);
const grossSaving = ref(false);

const cutModal = ref(false);
const cutBlock = ref<Block | null>(null);
const cutCount = ref(1);
const cutStain = ref<StainType>('H_AND_E');
const cutSpecialStain = ref('');
const cutNotes = ref('');
const cutSaving = ref(false);

const rejectModal = ref(false);
const rejectSpecimen = ref<Specimen | null>(null);
const rejectReason = ref('');
const rejectCode = ref('OTHER');
const rejectSaving = ref(false);

const wsiModal = ref(false);
const wsiSlide = ref<Slide | null>(null);
const wsiUrl = ref('');
const wsiViewerUrl = ref('');
const wsiScanner = ref('');
const wsiMagnification = ref('');
const wsiSaving = ref(false);

const stainModal = ref(false);
const stainBlock = ref<Block | null>(null);
const stainType = ref<'SPECIAL' | 'IMMUNOHISTOCHEMISTRY'>('SPECIAL');
const stainName = ref('');
const stainReason = ref('');
const stainSaving = ref(false);

const recutModal = ref(false);
const recutSlide = ref<Slide | null>(null);
const recutReason = ref('');
const recutSaving = ref(false);

const assignSaving = ref(false);

async function load(background = false): Promise<void> {
  if (background) refreshing.value = true;
  else loading.value = true;
  error.value = null;
  try {
    detail.value = await casesApi.get(caseId.value);
    assignmentSelection.value = detail.value.assignedPathologist?.id ?? '';
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
}

function slidesForBlock(block: Block): Slide[] {
  return (detail.value?.slides ?? []).filter((slide) => slide.blockId === block.id);
}

function blocksForSpecimen(specimen: Specimen): Block[] {
  return (detail.value?.blocks ?? []).filter((block) => block.specimenId === specimen.id);
}

function openGross(specimen: Specimen): void {
  grossSpecimen.value = specimen;
  grossDescription.value = specimen.description ?? '';
  grossBlockCount.value = 2;
  grossModal.value = true;
}

async function submitGross(): Promise<void> {
  if (!grossSpecimen.value) return;
  if (grossDescription.value.trim().length < 5) {
    toast.error(
      'Describe the specimen',
      'Gross description is required before blocks can be created.',
    );
    return;
  }
  grossSaving.value = true;
  try {
    const blocks = await casesApi.gross({
      specimenId: grossSpecimen.value.id,
      grossDescription: grossDescription.value.trim(),
      blockCount: grossBlockCount.value,
    });
    toast.success(
      'Blocks created',
      `${blocks.length} cassette${blocks.length === 1 ? '' : 's'} barcoded and awaiting grossing scan.`,
    );
    grossModal.value = false;
    await load(true);
  } catch (caught) {
    toast.error('Grossing could not be recorded', apiErrorMessage(caught));
  } finally {
    grossSaving.value = false;
  }
}

function openCut(block: Block, stain: StainType = 'H_AND_E'): void {
  cutBlock.value = block;
  cutCount.value = 1;
  cutStain.value = stain;
  cutSpecialStain.value = '';
  cutNotes.value = '';
  cutModal.value = true;
}

async function submitCut(): Promise<void> {
  if (!cutBlock.value) return;
  if (cutStain.value !== 'H_AND_E' && !cutSpecialStain.value.trim()) {
    toast.error('Name the stain', 'A special stain or antibody name is required.');
    return;
  }
  cutSaving.value = true;
  try {
    const slides = await casesApi.cut({
      blockId: cutBlock.value.id,
      count: cutCount.value,
      stainType: cutStain.value,
      specialStain: cutSpecialStain.value.trim() || undefined,
      notes: cutNotes.value.trim() || undefined,
    });
    toast.success(
      'Slides cut',
      `${slides.length} slide label${slides.length === 1 ? '' : 's'} created.`,
    );
    cutModal.value = false;
    await load(true);
  } catch (caught) {
    toast.error('Could not record slide cutting', apiErrorMessage(caught));
  } finally {
    cutSaving.value = false;
  }
}

function openReject(specimen: Specimen): void {
  rejectSpecimen.value = specimen;
  rejectReason.value = '';
  rejectCode.value = 'OTHER';
  rejectModal.value = true;
}

async function submitReject(): Promise<void> {
  if (!rejectSpecimen.value) return;
  if (rejectReason.value.trim().length < 5) {
    toast.error('Reason required', 'Record why the specimen is being rejected.');
    return;
  }
  rejectSaving.value = true;
  try {
    await casesApi.rejectSpecimen(
      rejectSpecimen.value.id,
      rejectReason.value.trim(),
      rejectCode.value,
    );
    toast.success('Specimen rejected', 'The custody timeline has been updated.');
    rejectModal.value = false;
    await load(true);
  } catch (caught) {
    toast.error('Could not reject the specimen', apiErrorMessage(caught));
  } finally {
    rejectSaving.value = false;
  }
}

function openWsi(slide: Slide): void {
  wsiSlide.value = slide;
  wsiUrl.value = slide.wsi?.url ?? '';
  wsiViewerUrl.value = slide.wsi?.viewerUrl ?? '';
  wsiScanner.value = slide.wsi?.scanner ?? '';
  wsiMagnification.value = slide.wsi?.magnification ?? '';
  wsiModal.value = true;
}

async function submitWsi(): Promise<void> {
  if (!wsiSlide.value) return;
  if (!/^https?:\/\//.test(wsiUrl.value.trim())) {
    toast.error('Image URL required', 'Use an http(s) URL to the whole-slide image.');
    return;
  }
  wsiSaving.value = true;
  try {
    await useApi().post(`/wsi/slides/${wsiSlide.value.id}/link`, {
      url: wsiUrl.value.trim(),
      viewerUrl: wsiViewerUrl.value.trim() || undefined,
      scanner: wsiScanner.value.trim() || undefined,
      magnification: wsiMagnification.value.trim() || undefined,
    });
    toast.success('WSI linked', 'The slide now opens in the whole-slide viewer.');
    wsiModal.value = false;
    await load(true);
  } catch (caught) {
    toast.error('Could not link the image', apiErrorMessage(caught));
  } finally {
    wsiSaving.value = false;
  }
}

function openStain(block: Block): void {
  stainBlock.value = block;
  stainType.value = 'SPECIAL';
  stainName.value = '';
  stainReason.value = '';
  stainModal.value = true;
}

async function submitStain(): Promise<void> {
  if (!stainBlock.value) return;
  if (!stainName.value.trim() || stainReason.value.trim().length < 5) {
    toast.error('Complete the stain request', 'Name the stain and record the clinical reason.');
    return;
  }
  stainSaving.value = true;
  try {
    await casesApi.requestStain({
      blockId: stainBlock.value.id,
      stainType: stainType.value,
      specialStain: stainName.value.trim(),
      reason: stainReason.value.trim(),
    });
    toast.success('Stain requested', 'A slide has been accessioned for the laboratory.');
    stainModal.value = false;
    await load(true);
  } catch (caught) {
    toast.error('Could not request the stain', apiErrorMessage(caught));
  } finally {
    stainSaving.value = false;
  }
}

function openRecut(slide: Slide): void {
  recutSlide.value = slide;
  recutReason.value = '';
  recutModal.value = true;
}

async function submitRecut(): Promise<void> {
  if (!recutSlide.value) return;
  if (recutReason.value.trim().length < 5) {
    toast.error('Reason required', 'Record why a recut is needed.');
    return;
  }
  recutSaving.value = true;
  try {
    await casesApi.recut(recutSlide.value.id, recutReason.value.trim());
    toast.success('Recut requested', 'Scan the slide at microtomy after the new section is cut.');
    recutModal.value = false;
    await load(true);
  } catch (caught) {
    toast.error('Could not request the recut', apiErrorMessage(caught));
  } finally {
    recutSaving.value = false;
  }
}

async function assign(pathologistId: string | null): Promise<void> {
  assignSaving.value = true;
  try {
    detail.value = await casesApi.assign(caseId.value, pathologistId);
    assignmentSelection.value = detail.value.assignedPathologist?.id ?? '';
    toast.success(
      pathologistId ? 'Case assigned' : 'Case unassigned',
      detail.value.assignedPathologist?.name ?? 'Unassigned queue',
    );
  } catch (caught) {
    toast.error('Assignment failed', apiErrorMessage(caught));
  } finally {
    assignSaving.value = false;
  }
}

async function printLabels(include: 'all' | 'specimens' | 'blocks' | 'slides'): Promise<void> {
  try {
    await documents.openCaseLabels(caseId.value, include);
  } catch (caught) {
    toast.error('Labels unavailable', apiErrorMessage(caught));
  }
}

async function openPdf(): Promise<void> {
  if (!detail.value?.report) return;
  try {
    await documents.openReportPdf(detail.value.report.id);
  } catch (caught) {
    toast.error('Report PDF unavailable', apiErrorMessage(caught));
  }
}

async function printEntity(entity: 'specimen' | 'block' | 'slide', id: string): Promise<void> {
  try {
    await documents.openLabel(entity, id);
  } catch (caught) {
    toast.error('Label unavailable', apiErrorMessage(caught));
  }
}

onMounted(async () => {
  await load();
  if (canAdmin.value || isPathologist.value) {
    try {
      pathologists.value = await casesApi.pathologists();
    } catch {
      pathologists.value = [];
    }
  }
});
</script>

<template>
  <div>
    <PageHeader
      v-if="detail"
      eyebrow="Case file"
      :title="detail.accessionNumber"
      :description="`${name(detail.patient.firstName, detail.patient.lastName)} · ${detail.patient.mrn} · ${detail.summary.specimenCount} specimen${detail.summary.specimenCount === 1 ? '' : 's'}`"
      back-to="/cases"
      back-label="Case register"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="btn btn-secondary"
            @click="
              refreshing = true;
              load(true);
            "
          >
            <AppIcon name="refresh" :size="13" :class="{ 'animate-spin': refreshing }" /> Refresh
          </button>
          <button type="button" class="btn btn-secondary" @click="printLabels('all')">
            <AppIcon name="print" :size="13" /> Labels
          </button>
          <button v-if="detail.report" type="button" class="btn btn-secondary" @click="openPdf">
            <AppIcon name="file" :size="13" /> PDF
          </button>
          <NuxtLink :to="`/patients/${detail.patient.id}/cumulative`" class="btn btn-secondary">
            <AppIcon name="file" :size="13" /> Cumulative
          </NuxtLink>
          <NuxtLink v-if="canOpenReport" :to="`/reports/${detail.id}`" class="btn btn-primary">
            <AppIcon name="edit" :size="13" />
            {{ detail.report ? 'Open report' : 'Start report' }}
          </NuxtLink>
        </div>
      </template>
      <template #meta>
        <StatusChip :status="detail.status" kind="case" size="sm" />
        <StatusChip :status="detail.priority" kind="priority" size="sm" />
        <span>Received {{ date(detail.receivedAt) }}</span>
        <span v-if="detail.assignedPathologist">{{ detail.assignedPathologist.name }}</span>
        <span v-else class="text-warning">Unassigned</span>
        <span
          v-for="request in detail.testRequests"
          :key="request.id"
          class="inline-flex items-center gap-1 border border-line bg-surface px-2 py-1 font-mono text-[9px] uppercase tracking-wide2 text-muted"
        >
          {{ DISCIPLINE_LABELS[request.discipline] }} ·
          {{ TEST_REQUEST_STATUS_LABELS[request.status] }}
        </span>
      </template>
    </PageHeader>

    <ErrorState v-if="error" :message="error" @retry="load()" />

    <LoadingSkeleton v-else-if="loading" :rows="8" />

    <template v-else-if="detail">
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
        <div class="min-w-0 space-y-6">
          <section class="panel">
            <div
              class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6"
            >
              <div>
                <h2 class="label-caps">Patient &amp; clinical</h2>
                <p class="mt-1 text-xs text-muted">
                  Demographics, referral and the clinical question.
                </p>
              </div>
              <AppIcon name="stethoscope" :size="18" class="text-muted" />
            </div>
            <div class="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
              <div>
                <p class="label-caps">Patient</p>
                <p class="mt-2 display text-2xl leading-tight">
                  {{ name(detail.patient.firstName, detail.patient.lastName) }}
                </p>
                <p class="mono mt-1 text-[11px] text-muted">{{ detail.patient.mrn }}</p>
                <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <dt class="text-muted">Sex</dt>
                  <dd>{{ sex(detail.patient.sex) }}</dd>
                  <dt class="text-muted">Age</dt>
                  <dd>{{ detail.patient.age ?? '—' }}</dd>
                  <dt class="text-muted">Date of birth</dt>
                  <dd>{{ detail.patient.dateOfBirth ?? '—' }}</dd>
                  <dt class="text-muted">Received</dt>
                  <dd>{{ date(detail.receivedAt) }}</dd>
                </dl>
              </div>
              <div>
                <p class="label-caps">Referral</p>
                <p class="mt-2 text-sm font-medium">{{ detail.referringClinician.name }}</p>
                <p class="mt-1 text-xs text-muted">
                  {{ detail.referringClinician.facility ?? 'Facility not recorded' }}
                </p>
                <p v-if="detail.referringClinician.phone" class="mono mt-1 text-[11px] text-muted">
                  {{ detail.referringClinician.phone }}
                </p>
                <p v-if="detail.referringClinician.email" class="mt-1 text-[11px] text-muted">
                  {{ detail.referringClinician.email }}
                </p>
                <p class="mt-4 label-caps">Subspecialty</p>
                <p class="mt-1.5 text-sm">{{ detail.subspecialty ?? 'Unassigned' }}</p>
              </div>
              <div class="sm:col-span-2">
                <p class="label-caps">Clinical history</p>
                <p class="mt-2 whitespace-pre-line text-sm leading-relaxed">
                  {{ detail.clinicalHistory }}
                </p>
                <p
                  v-if="detail.clinicalDiagnosis"
                  class="mt-3 border-l-2 border-accent/50 pl-3 text-sm text-muted"
                >
                  Clinical diagnosis: {{ detail.clinicalDiagnosis }}
                </p>
              </div>
            </div>
          </section>

          <section class="panel">
            <div
              class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6"
            >
              <div>
                <h2 class="label-caps">Specimen chain</h2>
                <p class="mt-1 text-xs text-muted">
                  Specimen → block → slide, with current projected state.
                </p>
              </div>
              <span class="font-mono text-[9px] uppercase tracking-wide2 text-muted">
                {{ detail.summary.blockCount }} blocks · {{ detail.summary.slideCount }} slides
              </span>
            </div>

            <div v-if="detail.specimens.length === 0" class="p-6 text-sm text-muted">
              No specimens recorded.
            </div>
            <div v-else class="divide-y divide-line">
              <article v-for="specimen in detail.specimens" :key="specimen.id" class="p-5 sm:p-6">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="flex items-start gap-3">
                    <span
                      class="flex h-11 w-11 shrink-0 items-center justify-center border border-line bg-canvas font-display text-xl"
                    >
                      {{ specimen.label }}
                    </span>
                    <div>
                      <h3 class="text-sm font-medium">{{ specimen.specimenType }}</h3>
                      <p class="text-xs text-muted">{{ specimen.site }}</p>
                      <p class="mono mt-1 text-[10px] text-muted">{{ specimen.barcode }}</p>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <StatusChip :status="specimen.status" kind="stage" size="sm" />
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      @click="printEntity('specimen', specimen.id)"
                    >
                      <AppIcon name="print" :size="12" /> Label
                    </button>
                    <button
                      v-if="canGross && specimen.status === 'ACCESSIONED'"
                      type="button"
                      class="btn btn-secondary btn-sm"
                      @click="openGross(specimen)"
                    >
                      <AppIcon name="block" :size="12" /> Gross
                    </button>
                    <button
                      v-if="
                        canGross && specimen.status !== 'REJECTED' && specimen.status !== 'ARCHIVED'
                      "
                      type="button"
                      class="btn btn-ghost btn-sm text-danger"
                      @click="openReject(specimen)"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <p
                  v-if="specimen.grossDescription"
                  class="mt-4 border-l border-line pl-3 text-xs leading-relaxed text-muted"
                >
                  <span class="label-caps mr-2">Gross</span>{{ specimen.grossDescription }}
                </p>
                <p
                  v-if="specimen.rejectionReason"
                  class="mt-3 border border-danger/30 bg-danger/[0.04] p-2.5 text-xs text-danger"
                >
                  Rejected: {{ specimen.rejectionReason }}
                </p>

                <div
                  v-if="blocksForSpecimen(specimen).length === 0"
                  class="mt-4 border border-dashed border-line-strong px-4 py-3 text-xs text-muted"
                >
                  No blocks yet. Record gross examination to create cassettes.
                </div>
                <div v-else class="mt-4 space-y-3">
                  <div
                    v-for="block in blocksForSpecimen(specimen)"
                    :key="block.id"
                    class="border border-line bg-canvas/40"
                  >
                    <div
                      class="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3.5 py-2.5"
                    >
                      <div class="flex items-center gap-2.5">
                        <AppIcon name="block" :size="14" class="text-muted" />
                        <span class="font-mono text-xs font-medium">{{ block.label }}</span>
                        <span class="mono text-[9px] text-muted">{{ block.barcode }}</span>
                        <StatusChip :status="block.status" kind="stage" size="sm" />
                      </div>
                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm"
                          @click="printEntity('block', block.id)"
                        >
                          <AppIcon name="print" :size="11" /> Label
                        </button>
                        <button
                          v-if="canCut && (block.status === 'EMBEDDED' || block.status === 'CUT')"
                          type="button"
                          class="btn btn-secondary btn-sm"
                          @click="openCut(block)"
                        >
                          <AppIcon name="slide" :size="11" /> Cut
                        </button>
                        <button
                          v-if="
                            canReport && block.status !== 'REJECTED' && block.status !== 'ARCHIVED'
                          "
                          type="button"
                          class="btn btn-ghost btn-sm"
                          @click="openStain(block)"
                        >
                          <AppIcon name="beaker" :size="11" /> Stain
                        </button>
                      </div>
                    </div>
                    <div
                      v-if="block.grossDescription"
                      class="px-3.5 py-2 text-[11px] leading-relaxed text-muted"
                    >
                      {{ block.grossDescription }}
                    </div>
                    <div
                      v-if="slidesForBlock(block).length === 0"
                      class="px-3.5 py-2.5 text-[11px] text-muted"
                    >
                      No slides cut.
                    </div>
                    <ul v-else class="divide-y divide-line/70">
                      <li
                        v-for="slide in slidesForBlock(block)"
                        :key="slide.id"
                        class="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2"
                      >
                        <div class="flex min-w-0 items-center gap-2.5">
                          <AppIcon name="slide" :size="12" class="text-muted" />
                          <span class="mono text-[11px]">{{ slide.label }}</span>
                          <span class="text-[10px] text-muted">
                            {{ STAIN_TYPE_LABELS[slide.stainType]
                            }}<template v-if="slide.specialStain">
                              · {{ slide.specialStain }}</template
                            >
                          </span>
                          <StatusChip :status="slide.status" kind="stage" size="sm" />
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="mono mr-2 hidden text-[9px] text-muted sm:inline">{{
                            slide.barcode
                          }}</span>
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm"
                            @click="printEntity('slide', slide.id)"
                          >
                            <AppIcon name="print" :size="11" /> Label
                          </button>
                          <a
                            v-if="slide.wsi?.viewerUrl"
                            :href="slide.wsi.viewerUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="btn btn-ghost btn-sm text-accent"
                          >
                            <AppIcon name="eye" :size="11" /> WSI
                          </a>
                          <button
                            v-else
                            type="button"
                            class="btn btn-ghost btn-sm"
                            @click="openWsi(slide)"
                          >
                            <AppIcon name="eye" :size="11" /> WSI
                          </button>
                          <button
                            v-if="
                              canReport &&
                              ['CUT', 'STAINED', 'WITH_PATHOLOGIST'].includes(slide.status)
                            "
                            type="button"
                            class="btn btn-ghost btn-sm"
                            @click="openRecut(slide)"
                          >
                            <AppIcon name="refresh" :size="11" /> Recut
                          </button>
                        </div>
                        <p
                          v-if="slide.requestReason"
                          class="w-full pl-5 text-[10px] italic text-muted"
                        >
                          {{ slide.requestReason }}
                        </p>
                      </li>
                    </ul>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section class="panel p-5 sm:p-6">
            <CustodyTimeline :events="detail.custodyEvents" :max="18" />
          </section>
        </div>

        <aside class="space-y-4">
          <section class="panel p-4">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="label-caps">Turnaround</h2>
              <span class="mono text-[9px] text-muted">{{ PRIORITY_LABELS[detail.priority] }}</span>
            </div>
            <TatCountdown
              :started-at="detail.receivedAt"
              :deadline="detail.tatDeadline"
              :warning-percent="auth.lab?.tatWarningPercent ?? 80"
              :done="detail.status === 'REPORTED' || detail.status === 'AMENDED'"
            />
            <dl class="mt-3 space-y-1.5 text-[11px]">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Received</dt>
                <dd class="mono">{{ dateTime(detail.receivedAt) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Deadline</dt>
                <dd class="mono">{{ dateTime(detail.tatDeadline) }}</dd>
              </div>
              <div v-if="detail.reportedAt" class="flex justify-between gap-3">
                <dt class="text-muted">Reported</dt>
                <dd class="mono">{{ dateTime(detail.reportedAt) }}</dd>
              </div>
            </dl>
          </section>

          <section class="panel p-4">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="label-caps">Report</h2>
              <span v-if="detail.report" class="mono text-[9px] text-muted"
                >v{{ detail.report.version }}</span
              >
            </div>
            <template v-if="detail.report">
              <StatusChip :status="detail.report.status" kind="report" size="sm" />
              <p class="mt-3 text-xs leading-relaxed text-muted">
                {{ detail.report.protocol.title }}
              </p>
              <div class="mt-3 border-t border-line pt-3 text-[11px]">
                <p v-if="detail.report.signedOutBy" class="flex justify-between gap-2">
                  <span class="text-muted">Signed by</span>
                  <span>{{ detail.report.signedOutBy.name }}</span>
                </p>
                <p v-if="detail.report.signedOutAt" class="mt-1 flex justify-between gap-2">
                  <span class="text-muted">Signed</span>
                  <span class="mono">{{ dateTime(detail.report.signedOutAt) }}</span>
                </p>
                <p v-if="detail.report.verificationCode" class="mt-1 flex justify-between gap-2">
                  <span class="text-muted">Verify</span>
                  <span class="mono">{{ detail.report.verificationCode }}</span>
                </p>
              </div>
              <div
                v-if="detail.report.status === 'DRAFT' && detail.report.missingRequired.length > 0"
                class="mt-3 border border-warning/30 bg-warning/[0.06] p-2.5 text-[11px] text-ink"
              >
                {{ detail.report.missingRequired.length }} required field{{
                  detail.report.missingRequired.length === 1 ? '' : 's'
                }}
                outstanding.
              </div>
              <div class="mt-4 flex flex-col gap-2">
                <button type="button" class="btn btn-secondary w-full" @click="openPdf">
                  <AppIcon name="eye" :size="12" /> Preview PDF
                </button>
                <NuxtLink
                  v-if="canOpenReport"
                  :to="`/reports/${detail.id}`"
                  class="btn btn-primary w-full"
                >
                  <AppIcon name="edit" :size="12" />
                  {{ detail.report.status === 'DRAFT' ? 'Continue report' : 'View / amend' }}
                </NuxtLink>
              </div>
            </template>
            <template v-else>
              <p class="text-xs leading-relaxed text-muted">
                No synoptic report has been started. The pathologist selects a protocol and signs
                out from the report editor.
              </p>
              <NuxtLink
                v-if="canReport"
                :to="`/reports/${detail.id}`"
                class="btn btn-primary mt-4 w-full"
              >
                <AppIcon name="edit" :size="12" /> Start synoptic report
              </NuxtLink>
            </template>
          </section>

          <section class="panel p-4">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="label-caps">Assignment</h2>
              <AppIcon name="user" :size="14" class="text-muted" />
            </div>
            <p class="text-xs">
              <template v-if="detail.assignedPathologist">{{
                detail.assignedPathologist.name
              }}</template>
              <template v-else><span class="text-warning">Unassigned</span></template>
            </p>
            <template
              v-if="isPathologist && detail.assignedPathologist?.id !== auth.user?.id && !isClosed"
            >
              <button
                type="button"
                class="btn btn-secondary mt-3 w-full"
                :disabled="assignSaving"
                @click="assign(auth.user?.id ?? null)"
              >
                <AppIcon name="user" :size="12" /> Assign to me
              </button>
            </template>
            <template v-if="canAdmin && pathologists.length > 0">
              <div class="mt-3 flex gap-2">
                <SearchSelect
                  v-model="assignmentSelection"
                  :options="assignmentOptions"
                  :full-width="false"
                  class="input-sm min-w-0 flex-1"
                  aria-label="Assign pathologist"
                  placeholder="Unassigned"
                />
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :disabled="assignSaving"
                  @click="assign(assignmentSelection || null)"
                >
                  Save
                </button>
              </div>
            </template>
          </section>

          <section class="panel p-4">
            <h2 class="label-caps">Labels</h2>
            <div class="mt-3 space-y-1.5">
              <button
                type="button"
                class="btn btn-secondary w-full justify-start"
                @click="printLabels('specimens')"
              >
                <AppIcon name="flask" :size="12" /> Specimen labels
              </button>
              <button
                type="button"
                class="btn btn-secondary w-full justify-start"
                @click="printLabels('blocks')"
              >
                <AppIcon name="block" :size="12" /> Block labels
              </button>
              <button
                type="button"
                class="btn btn-secondary w-full justify-start"
                @click="printLabels('slides')"
              >
                <AppIcon name="slide" :size="12" /> Slide labels
              </button>
            </div>
            <p
              class="mt-3 font-mono text-[9px] uppercase leading-relaxed tracking-wide2 text-muted"
            >
              PDF labels include a Data Matrix; ZPL output is available from the labels API.
            </p>
          </section>
        </aside>
      </div>
    </template>

    <AppModal
      v-model="grossModal"
      title="Record gross examination"
      :description="
        grossSpecimen
          ? `${grossSpecimen.label} · ${grossSpecimen.specimenType}, ${grossSpecimen.site}`
          : ''
      "
      :persistent="grossSaving"
    >
      <div class="space-y-4">
        <FormField
          label="Gross description"
          for-id="gross-description"
          required
          hint="Describe size, appearance, sampling and orientation."
        >
          <textarea
            id="gross-description"
            v-model="grossDescription"
            class="textarea min-h-[120px]"
          />
        </FormField>
        <FormField
          label="Number of blocks"
          for-id="gross-blocks"
          required
          hint="Each cassette receives a unique Data Matrix barcode."
        >
          <input
            id="gross-blocks"
            v-model.number="grossBlockCount"
            type="number"
            min="1"
            max="30"
            class="input w-32"
          />
        </FormField>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="grossSaving"
          @click="grossModal = false"
        >
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="grossSaving" @click="submitGross">
          <AppIcon v-if="grossSaving" name="refresh" :size="13" class="animate-spin" />
          <AppIcon v-else name="block" :size="13" />
          Create {{ grossBlockCount }} block{{ grossBlockCount === 1 ? '' : 's' }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="cutModal"
      title="Cut slides"
      :description="cutBlock ? `Block ${cutBlock.label} · ${cutBlock.barcode}` : ''"
      :persistent="cutSaving"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <FormField label="Slide count" for-id="cut-count" required>
          <input
            id="cut-count"
            v-model.number="cutCount"
            type="number"
            min="1"
            max="20"
            class="input"
          />
        </FormField>
        <FormField label="Stain" for-id="cut-stain">
          <SearchSelect
            id="cut-stain"
            v-model="cutStain"
            :options="stainOptions"
            placeholder="Select stain"
          />
        </FormField>
        <div v-if="cutStain !== 'H_AND_E'" class="sm:col-span-2">
          <FormField label="Stain / antibody" for-id="cut-special" required>
            <input
              id="cut-special"
              v-model="cutSpecialStain"
              class="input"
              placeholder="CK20, p16, PAS…"
            />
          </FormField>
        </div>
        <div class="sm:col-span-2">
          <FormField label="Notes" for-id="cut-notes" optional>
            <input
              id="cut-notes"
              v-model="cutNotes"
              class="input"
              placeholder="Section thickness, orientation, issue…"
            />
          </FormField>
        </div>
      </div>
      <template #footer>
        <button type="button" class="btn btn-ghost" :disabled="cutSaving" @click="cutModal = false">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="cutSaving" @click="submitCut">
          <AppIcon name="slide" :size="13" /> Record cutting
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="wsiModal"
      title="Link whole-slide image"
      :description="wsiSlide ? `Slide ${wsiSlide.label}` : ''"
      :persistent="wsiSaving"
    >
      <div class="space-y-4">
        <FormField
          label="Image URL"
          for-id="wsi-url"
          required
          hint="Usually an .svs, .tiff or vendor viewer URL."
        >
          <input
            id="wsi-url"
            v-model="wsiUrl"
            class="input font-mono text-xs"
            placeholder="https://wsi.example.org/slides/SL-…"
          />
        </FormField>
        <FormField
          label="Viewer URL"
          for-id="wsi-viewer"
          hint="Optional; defaults to the image URL."
        >
          <input
            id="wsi-viewer"
            v-model="wsiViewerUrl"
            class="input font-mono text-xs"
            placeholder="https://viewer.example.org/slide/…"
          />
        </FormField>
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="Scanner" for-id="wsi-scanner"
            ><input
              id="wsi-scanner"
              v-model="wsiScanner"
              class="input"
              placeholder="Leica Aperio GT450"
          /></FormField>
          <FormField label="Magnification" for-id="wsi-mag"
            ><input id="wsi-mag" v-model="wsiMagnification" class="input" placeholder="40x"
          /></FormField>
        </div>
      </div>
      <template #footer>
        <button type="button" class="btn btn-ghost" :disabled="wsiSaving" @click="wsiModal = false">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="wsiSaving" @click="submitWsi">
          <AppIcon name="eye" :size="13" /> Link image
        </button>
      </template>
    </AppModal>

    <AppModal v-model="rejectModal" title="Reject specimen" :persistent="rejectSaving">
      <FormField label="Reason code" for-id="reject-code" required>
        <SearchSelect
          id="reject-code"
          v-model="rejectCode"
          :options="rejectionOptions"
          placeholder="Select reason code"
        />
      </FormField>
      <FormField
        label="Reason"
        for-id="reject-reason"
        required
        hint="This becomes part of the immutable custody record."
      >
        <textarea
          id="reject-reason"
          v-model="rejectReason"
          class="textarea min-h-[100px]"
          placeholder="Container leaked, tissue uninterpretable, wrong fixative…"
        />
      </FormField>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="rejectSaving"
          @click="rejectModal = false"
        >
          Cancel
        </button>
        <button type="button" class="btn btn-danger" :disabled="rejectSaving" @click="submitReject">
          <AppIcon name="x" :size="13" /> Reject specimen
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="stainModal"
      title="Request stain"
      :description="stainBlock ? `Block ${stainBlock.label}` : ''"
      :persistent="stainSaving"
    >
      <div class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <FormField label="Stain type" for-id="stain-type">
            <SearchSelect
              id="stain-type"
              v-model="stainType"
              :options="stainTypeOptions"
              placeholder="Select stain type"
            />
          </FormField>
          <FormField label="Stain / antibody" for-id="stain-name" required>
            <input id="stain-name" v-model="stainName" class="input" placeholder="CK7, p63, PAS…" />
          </FormField>
        </div>
        <FormField label="Reason" for-id="stain-reason" required>
          <textarea
            id="stain-reason"
            v-model="stainReason"
            class="textarea min-h-[80px]"
            placeholder="Why is this extra stain needed?"
          />
        </FormField>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="stainSaving"
          @click="stainModal = false"
        >
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="stainSaving" @click="submitStain">
          <AppIcon name="beaker" :size="13" /> Request stain
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="recutModal"
      title="Request recut"
      :description="recutSlide ? `Slide ${recutSlide.label}` : ''"
      :persistent="recutSaving"
    >
      <FormField label="Reason" for-id="recut-reason" required>
        <textarea
          id="recut-reason"
          v-model="recutReason"
          class="textarea min-h-[90px]"
          placeholder="Section folded, tangential, insufficient tissue…"
        />
      </FormField>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="recutSaving"
          @click="recutModal = false"
        >
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="recutSaving" @click="submitRecut">
          <AppIcon name="refresh" :size="13" /> Send for recut
        </button>
      </template>
    </AppModal>

    <ReportPdfModal
      v-model="pdfOpen"
      :report-id="detail?.report?.id ?? null"
      :accession-number="detail?.accessionNumber ?? ''"
    />
  </div>
</template>
