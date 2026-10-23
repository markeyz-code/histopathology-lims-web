<script setup lang="ts">
import type { CaseDetail, ReportCoding, ReportDetail, UserSummary } from '@lims/shared';

definePageMeta({ title: 'Synoptic report', roles: ['PATHOLOGIST', 'SUPER_ADMIN'] });
useHead({ title: 'Synoptic report' });

const route = useRoute();
const toast = useToast();
const api = useApi();
const auth = useAuthStore();
const casesApi = useCases();
const { dateTime, relative, name } = useFormat();

const caseId = String(route.params.caseId);
const caseDetail = ref<CaseDetail | null>(null);
const caseLoading = ref(true);
const caseError = ref<string | null>(null);
const form = useReportForm(caseId);

const pdfOpen = ref(false);
const signOutOpen = ref(false);
const amendOpen = ref(false);
const amendmentMode = ref(false);
const signatureConfirmed = ref(false);
const amendReason = ref('');
const starting = ref(false);
const releaseOpen = ref(false);
const releaseNote = ref('');
const releasing = ref(false);
const opinionOpen = ref(false);
const opinionReason = ref('');
const opinionReviewer = ref('');
const pathologists = ref<UserSummary[]>([]);
const opinionSaving = ref(false);

const reviewerOptions = computed(() => [
  { value: '', label: 'Any available pathologist' },
  ...pathologists.value
    .filter((person) => person.id !== auth.user?.id)
    .map((person) => ({ value: person.id, label: person.name })),
]);

const report = computed(() => form.report.value);
const content = computed(() => form.content.value);
const editableDraft = computed(() => form.isEditable.value && Boolean(report.value));
const canAmend = computed(
  () => report.value?.status === 'SIGNED_OUT' || report.value?.status === 'AMENDED',
);
const formDisabled = computed(() => !editableDraft.value && !amendmentMode.value);
const missingCount = computed(() => form.missing.value.length);
const requiredTotal = computed(() => form.completeness.value?.requiredTotal ?? 0);
const requiredCompleted = computed(() => form.completeness.value?.requiredCompleted ?? 0);
const progress = computed(() =>
  requiredTotal.value === 0
    ? 100
    : Math.round((requiredCompleted.value / requiredTotal.value) * 100),
);
const codingModel = computed<ReportCoding>({
  get: () => form.coding.value,
  set: (value) => {
    form.coding.value = value;
  },
});
const isReleased = computed(() => Boolean(form.report.value?.releasedAt));

async function init(): Promise<void> {
  caseLoading.value = true;
  caseError.value = null;
  try {
    caseDetail.value = await casesApi.get(caseId);
    await form.load();
    pathologists.value = await api.get<UserSummary[]>('/users/pathologists').catch(() => []);
    if (!form.report.value && form.protocols.value.length > 0) {
      const match = form.protocols.value.find(
        (protocol) => protocol.subspecialty === caseDetail.value?.subspecialty,
      );
      if (match) form.protocolId.value = match.id;
    }
  } catch (caught) {
    caseError.value = apiErrorMessage(caught);
  } finally {
    caseLoading.value = false;
  }
}

async function startReport(): Promise<void> {
  starting.value = true;
  const ok = await form.startReport();
  starting.value = false;
  if (ok) {
    await casesApi.get(caseId).then((detail) => {
      caseDetail.value = detail;
    });
  }
}

async function releaseReport(): Promise<void> {
  if (!form.report.value) return;
  releasing.value = true;
  try {
    const released = await api.post<ReportDetail>(`/reports/${form.report.value.id}/release`, {
      note: releaseNote.value || undefined,
    });
    form.report.value = released;
    releaseOpen.value = false;
    releaseNote.value = '';
    toast.success('Report released', 'The referrer can now see it in the portal.');
  } catch (caught) {
    toast.error('Could not release report', apiErrorMessage(caught));
  } finally {
    releasing.value = false;
  }
}

async function requestSecondOpinion(): Promise<void> {
  if (!form.report.value) return;
  if (opinionReason.value.trim().length < 5) {
    toast.error('Reason required', 'Explain why a second opinion is needed.');
    return;
  }
  opinionSaving.value = true;
  try {
    await api.post('/qa/reviews', {
      caseId,
      reportId: form.report.value.id,
      type: 'SECOND_OPINION',
      reviewerId: opinionReviewer.value || undefined,
      reason: opinionReason.value.trim(),
    });
    opinionOpen.value = false;
    opinionReason.value = '';
    opinionReviewer.value = '';
    toast.success('Second opinion requested', 'The reviewer will find it in QA review.');
  } catch (caught) {
    toast.error('Could not request second opinion', apiErrorMessage(caught));
  } finally {
    opinionSaving.value = false;
  }
}

async function save(): Promise<void> {
  if (!editableDraft.value) return;
  await form.save();
}

async function confirmSignOut(): Promise<void> {
  if (!signatureConfirmed.value) {
    toast.error('Confirm the signature', 'Tick the confirmation before signing out.');
    return;
  }
  const ok = await form.signOut();
  if (ok) {
    signOutOpen.value = false;
    signatureConfirmed.value = false;
    await casesApi.get(caseId).then((detail) => {
      caseDetail.value = detail;
    });
  }
}

async function confirmAmend(): Promise<void> {
  if (amendReason.value.trim().length < 10) {
    toast.error(
      'Reason required',
      'Give a clear reason for the amendment (at least 10 characters).',
    );
    return;
  }
  const ok = await form.amend(amendReason.value.trim());
  if (ok) {
    amendOpen.value = false;
    amendmentMode.value = false;
    amendReason.value = '';
    await casesApi.get(caseId).then((detail) => {
      caseDetail.value = detail;
    });
  }
}

async function discardAmendment(): Promise<void> {
  amendmentMode.value = false;
  amendReason.value = '';
  await form.load();
}

async function openPdf(): Promise<void> {
  if (!report.value) return;
  pdfOpen.value = true;
}

function beginAmendment(): void {
  amendmentMode.value = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's' && editableDraft.value) {
    event.preventDefault();
    void save();
  }
}

onMounted(async () => {
  await init();
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});

onBeforeRouteLeave(() => {
  if ((editableDraft.value || amendmentMode.value) && form.dirty.value) {
    return window.confirm('You have unsaved report changes. Leave without saving?');
  }
  return true;
});
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Synoptic reporting"
      :title="content?.title ?? 'Start a report'"
      :description="
        caseDetail
          ? `${caseDetail.accessionNumber} · ${name(caseDetail.patient.firstName, caseDetail.patient.lastName)} · ${caseDetail.subspecialty ?? 'No subspecialty'}`
          : undefined
      "
      :back-to="`/cases/${caseId}`"
      back-label="Case file"
    >
      <template #actions>
        <button v-if="report" type="button" class="btn btn-secondary" @click="openPdf">
          <AppIcon name="eye" :size="13" /> Preview PDF
        </button>
        <button
          v-if="editableDraft"
          type="button"
          class="btn btn-secondary"
          :disabled="form.saving.value"
          @click="save"
        >
          <AppIcon name="save" :size="13" /> Save draft
        </button>
        <button
          v-if="canAmend && !amendmentMode"
          type="button"
          class="btn btn-secondary"
          @click="beginAmendment"
        >
          <AppIcon name="edit" :size="13" /> Amend report
        </button>
        <button
          v-if="report && (report.status === 'SIGNED_OUT' || report.status === 'AMENDED')"
          type="button"
          class="btn btn-secondary"
          @click="opinionOpen = true"
        >
          <AppIcon name="shield" :size="13" /> Second opinion
        </button>
        <button
          v-if="
            report && (report.status === 'SIGNED_OUT' || report.status === 'AMENDED') && !isReleased
          "
          type="button"
          class="btn btn-primary"
          @click="releaseOpen = true"
        >
          <AppIcon name="send" :size="13" /> Release to referrer
        </button>
        <button
          v-if="editableDraft"
          type="button"
          class="btn btn-primary"
          :disabled="missingCount > 0"
          @click="signOutOpen = true"
        >
          <AppIcon name="lock" :size="13" /> Sign out
        </button>
        <button
          v-if="amendmentMode"
          type="button"
          class="btn btn-primary"
          @click="amendOpen = true"
        >
          <AppIcon name="lock" :size="13" /> Sign amendment
        </button>
      </template>
      <template #meta>
        <StatusChip v-if="report" :status="report.status" kind="report" size="sm" />
        <span v-if="report"
          >Version {{ report.version }} · protocol v{{ report.protocol.version }}</span
        >
        <span v-if="report?.signedOutBy">Signed by {{ report.signedOutBy.name }}</span>
        <span v-if="report?.releasedAt" class="text-success"
          >Released {{ dateTime(report.releasedAt) }}</span
        >
      </template>
    </PageHeader>

    <ErrorState v-if="caseError" :message="caseError" @retry="init" />

    <LoadingSkeleton v-else-if="caseLoading" :rows="8" />

    <template v-else-if="caseDetail">
      <div v-if="!report" class="panel p-5 sm:p-7">
        <div class="max-w-2xl">
          <p class="label-caps">Step 1 of 2</p>
          <h2 class="display mt-2 text-3xl">Choose the synoptic protocol</h2>
          <p class="mt-2 text-sm leading-relaxed text-muted">
            The protocol defines the structured fields, required data and the narrative generated
            for
            {{ caseDetail.accessionNumber }}. A snapshot is stored with the report so later protocol
            edits cannot alter it.
          </p>
        </div>

        <div v-if="form.loading.value" class="mt-6">
          <LoadingSkeleton kind="cards" :rows="3" />
        </div>
        <div
          v-else-if="form.protocols.value.length === 0"
          class="mt-6 border border-dashed border-line-strong p-5 text-sm text-muted"
        >
          No active protocols are configured. Ask a laboratory administrator to create one.
        </div>
        <template v-else>
          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              v-for="protocol in form.protocols.value"
              :key="protocol.id"
              type="button"
              class="border p-4 text-left transition-colors"
              :class="
                form.protocolId.value === protocol.id
                  ? 'border-accent bg-accent/[0.05]'
                  : 'border-line bg-raised hover:border-line-strong'
              "
              :aria-pressed="form.protocolId.value === protocol.id"
              @click="form.protocolId.value = protocol.id"
            >
              <span class="flex items-center justify-between gap-2">
                <span class="font-mono text-[9px] uppercase tracking-wide2 text-muted">{{
                  protocol.subspecialty
                }}</span>
                <span class="mono text-[9px] text-muted">v{{ protocol.version }}</span>
              </span>
              <span class="mt-2 block text-sm font-medium">{{ protocol.title }}</span>
              <span class="mt-1 block text-xs text-muted">{{ protocol.cancerType }}</span>
              <span class="mt-2 block font-mono text-[9px] uppercase tracking-wide2 text-muted">
                {{ protocol.content.sections.length }} sections ·
                {{
                  protocol.content.sections.reduce((sum, section) => sum + section.fields.length, 0)
                }}
                fields
              </span>
            </button>
          </div>
          <div class="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!form.protocolId.value || starting || form.saving.value"
              @click="startReport"
            >
              <AppIcon name="file" :size="13" /> Start draft report
            </button>
            <NuxtLink :to="`/cases/${caseId}`" class="btn btn-ghost">Back to case</NuxtLink>
          </div>
        </template>
      </div>

      <template v-else-if="content">
        <div v-if="amendmentMode" class="mb-4 border border-warning/40 bg-warning/[0.07] p-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex gap-3">
              <AppIcon name="edit" :size="18" class="mt-0.5 shrink-0 text-warning" />
              <div>
                <p class="font-mono text-2xs uppercase tracking-caps text-warning">
                  Amendment mode
                </p>
                <p class="mt-1 text-sm text-ink">
                  Editing creates version {{ report ? report.version + 1 : 1 }}. The signed
                  version{{ report && report.version > 1 ? 's' : '' }} remain{{
                    report && report.version > 1 ? '' : 's'
                  }}
                  immutable and visible in the version history.
                </p>
              </div>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" @click="discardAmendment">
              Discard changes
            </button>
          </div>
        </div>

        <div
          v-if="!amendmentMode"
          class="mb-5 flex flex-wrap items-center gap-3 border border-line bg-surface px-4 py-3"
        >
          <div class="flex min-w-0 items-center gap-2">
            <AppIcon
              :name="report?.status === 'DRAFT' ? 'edit' : 'lock'"
              :size="15"
              :class="report?.status === 'DRAFT' ? 'text-accent' : 'text-success'"
            />
            <span class="text-xs">
              <template v-if="report?.status === 'DRAFT'"
                >Draft — not valid until signed out.</template
              >
              <template v-else-if="report?.status === 'SIGNED_OUT'"
                >Signed out and locked. Amendments create a new version.</template
              >
              <template v-else
                >Amended report. The latest signed version is authoritative.</template
              >
            </span>
          </div>
          <span class="ml-auto font-mono text-[9px] uppercase tracking-wide2 text-muted">
            {{ form.dirty.value ? 'Unsaved changes' : 'All changes saved' }}
          </span>
        </div>

        <div class="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
          <div class="min-w-0 space-y-5">
            <section
              v-for="(section, sectionIndex) in content.sections"
              :key="section.key"
              class="panel"
            >
              <div class="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
                <span class="display text-2xl leading-none text-accent">{{
                  String(sectionIndex + 1).padStart(2, '0')
                }}</span>
                <div>
                  <h2 class="display text-xl">{{ section.title }}</h2>
                  <p v-if="section.description" class="mt-1 text-xs text-muted">
                    {{ section.description }}
                  </p>
                </div>
              </div>
              <div class="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
                <ProtocolFieldInput
                  v-for="field in section.fields"
                  :key="field.key"
                  :field="field"
                  :model-value="form.data[field.key]"
                  :error="form.fieldError(field.key)"
                  :disabled="formDisabled"
                  @update:model-value="(value) => form.setField(field.key, value)"
                />
              </div>
            </section>

            <ReportCodingCard v-model="codingModel" :disabled="formDisabled" />

            <div
              v-if="editableDraft"
              class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
            >
              <p class="font-mono text-[9px] uppercase tracking-wide2 text-muted">
                <AppIcon name="keyboard" :size="11" class="mr-1 inline" /> Ctrl / ⌘ + S to save
              </p>
              <div class="flex gap-2">
                <button
                  type="button"
                  class="btn btn-secondary"
                  :disabled="form.saving.value"
                  @click="save"
                >
                  <AppIcon name="save" :size="13" /> Save draft
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  :disabled="missingCount > 0"
                  @click="signOutOpen = true"
                >
                  <AppIcon name="lock" :size="13" /> Sign out
                </button>
              </div>
            </div>
            <div
              v-else-if="amendmentMode"
              class="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"
            >
              <p class="text-xs text-muted">Amendments are signed with a new version and reason.</p>
              <div class="flex gap-2">
                <button type="button" class="btn btn-ghost" @click="discardAmendment">
                  Discard
                </button>
                <button type="button" class="btn btn-primary" @click="amendOpen = true">
                  <AppIcon name="lock" :size="13" /> Sign amendment
                </button>
              </div>
            </div>
          </div>

          <aside class="space-y-4">
            <section class="panel p-4">
              <div class="flex items-center justify-between gap-3">
                <h2 class="label-caps">Completeness</h2>
                <span
                  class="mono text-[11px]"
                  :class="missingCount > 0 ? 'text-warning' : 'text-success'"
                >
                  {{ requiredCompleted }}/{{ requiredTotal }}
                </span>
              </div>
              <div class="mt-3 h-2 bg-line">
                <div
                  class="h-full transition-[width]"
                  :class="progress === 100 ? 'bg-success' : 'bg-warning'"
                  :style="{ width: `${progress}%` }"
                />
              </div>
              <p class="mt-2 font-mono text-[9px] uppercase tracking-wide2 text-muted">
                {{ progress }}% of required fields
              </p>
              <div v-if="missingCount > 0" class="mt-3 border-t border-line pt-3">
                <p class="font-mono text-[9px] uppercase tracking-wide2 text-warning">
                  Outstanding
                </p>
                <ul class="mt-2 space-y-1 text-[11px] text-muted">
                  <li
                    v-for="label in form.missing.value.slice(0, 8)"
                    :key="label"
                    class="flex gap-2"
                  >
                    <span class="text-warning">·</span>{{ label }}
                  </li>
                  <li v-if="missingCount > 8" class="text-muted">+{{ missingCount - 8 }} more</li>
                </ul>
              </div>
              <p v-else class="mt-3 flex items-center gap-1.5 text-[11px] text-success">
                <AppIcon name="check" :size="12" /> Ready for sign-out
              </p>
            </section>

            <section class="panel p-4">
              <div class="flex items-center justify-between gap-3">
                <h2 class="label-caps">Narrative preview</h2>
                <span class="mono text-[9px] text-muted">auto-generated</span>
              </div>
              <pre
                class="mt-3 max-h-[400px] overflow-auto whitespace-pre-wrap border border-line bg-canvas p-3 font-sans text-[11px] leading-relaxed text-ink scroll-area"
                >{{ form.narrative.value }}</pre>
            </section>

            <section class="panel p-4">
              <h2 class="label-caps">Report record</h2>
              <dl class="mt-3 space-y-2 text-[11px]">
                <div class="flex justify-between gap-2">
                  <dt class="text-muted">Status</dt>
                  <dd>
                    <StatusChip :status="report?.status ?? 'DRAFT'" kind="report" size="sm" />
                  </dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt class="text-muted">Version</dt>
                  <dd class="mono">v{{ report?.version ?? 0 }}</dd>
                </div>
                <div class="flex justify-between gap-2">
                  <dt class="text-muted">Protocol</dt>
                  <dd class="mono">v{{ report?.protocol.version ?? 1 }}</dd>
                </div>
                <div v-if="report?.signedOutAt" class="flex justify-between gap-2">
                  <dt class="text-muted">Signed</dt>
                  <dd class="mono">{{ dateTime(report.signedOutAt) }}</dd>
                </div>
                <div v-if="report?.verificationCode" class="flex justify-between gap-2">
                  <dt class="text-muted">Verify</dt>
                  <dd class="mono">{{ report.verificationCode }}</dd>
                </div>
              </dl>
              <NuxtLink
                v-if="report?.verificationCode"
                :to="`/verify/${report.verificationCode}`"
                target="_blank"
                class="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-caps text-accent hover:underline"
              >
                Public verification <AppIcon name="external" :size="10" />
              </NuxtLink>
            </section>

            <section v-if="(report?.versions.length ?? 0) > 0" class="panel p-4">
              <h2 class="label-caps">Version history</h2>
              <ol class="mt-3 space-y-3">
                <li
                  v-for="version in [...(report?.versions ?? [])].reverse()"
                  :key="version.id"
                  class="border-l border-line pl-3"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="mono text-[11px]">v{{ version.version }}</span>
                    <span class="font-mono text-[9px] uppercase tracking-wide2 text-muted">{{
                      version.action.replace('_', ' ')
                    }}</span>
                  </div>
                  <p class="mt-0.5 text-[10px] text-muted">
                    {{ version.createdBy?.name ?? 'Pathologist' }} ·
                    {{ relative(version.createdAt) }}
                  </p>
                  <p v-if="version.reason" class="mt-1 text-[10px] italic text-muted">
                    {{ version.reason }}
                  </p>
                </li>
              </ol>
            </section>

            <section
              v-if="report?.amendmentReason && !amendmentMode"
              class="border border-warning/40 bg-warning/[0.06] p-4"
            >
              <p class="label-caps text-warning">Amendment reason</p>
              <p class="mt-2 text-xs leading-relaxed text-ink">{{ report.amendmentReason }}</p>
            </section>
          </aside>
        </div>
      </template>

      <EmptyState
        v-else
        icon="protocols"
        title="Report unavailable"
        message="The case report exists but the protocol snapshot could not be loaded."
      />
    </template>

    <AppModal
      v-model="releaseOpen"
      title="Release to referrer"
      description="The report becomes visible in the referral portal and the referrer is notified."
      :persistent="releasing"
    >
      <div class="space-y-4">
        <FormField label="Release note (optional)" for-id="release-note">
          <input
            id="release-note"
            v-model="releaseNote"
            class="input"
            placeholder="Seen at MDT; copy to clinician."
          />
        </FormField>
        <p class="text-xs leading-relaxed text-muted">
          Only a signed or amended report can be released. An amendment resets the release and must
          be released again.
        </p>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="releasing"
          @click="releaseOpen = false"
        >
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="releasing" @click="releaseReport">
          <AppIcon name="send" :size="13" /> {{ releasing ? 'Releasing…' : 'Release report' }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="opinionOpen"
      title="Request a second opinion"
      description="Creates a QA review linked to this signed report."
      :persistent="opinionSaving"
    >
      <div class="space-y-4">
        <FormField label="Reviewer" for-id="opinion-reviewer">
          <SearchSelect
            id="opinion-reviewer"
            v-model="opinionReviewer"
            :options="reviewerOptions"
            placeholder="Any available pathologist"
          />
        </FormField>
        <FormField label="Why is this needed?" for-id="opinion-reason" required>
          <textarea
            id="opinion-reason"
            v-model="opinionReason"
            class="textarea min-h-[90px]"
            placeholder="Diagnostic uncertainty, unusual morphology, clinician request…"
          />
        </FormField>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="opinionSaving"
          @click="opinionOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="opinionSaving"
          @click="requestSecondOpinion"
        >
          <AppIcon name="shield" :size="13" />
          {{ opinionSaving ? 'Requesting…' : 'Request review' }}
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="signOutOpen"
      title="Sign out this report?"
      description="Sign-out validates every required field, writes an immutable version, marks reviewed slides and blocks REPORTED, and locks the report."
      :persistent="form.saving.value"
    >
      <div class="space-y-4">
        <div class="border border-line bg-canvas p-4 text-sm">
          <div class="flex justify-between gap-3">
            <span class="text-muted">Case</span
            ><span class="mono">{{ caseDetail?.accessionNumber }}</span>
          </div>
          <div class="mt-1.5 flex justify-between gap-3">
            <span class="text-muted">Required fields</span
            ><span class="mono">{{ requiredCompleted }}/{{ requiredTotal }}</span>
          </div>
          <div class="mt-1.5 flex justify-between gap-3">
            <span class="text-muted">Report version</span
            ><span class="mono">v{{ (report?.version ?? 0) + 1 }}</span>
          </div>
        </div>
        <div
          v-if="missingCount > 0"
          class="border border-warning/40 bg-warning/[0.07] p-3 text-xs text-ink"
        >
          Complete the {{ missingCount }} outstanding required field{{
            missingCount === 1 ? '' : 's'
          }}
          before signing.
        </div>
        <label class="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed">
          <input
            v-model="signatureConfirmed"
            type="checkbox"
            class="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
          />
          <span
            >I confirm this is my pathology interpretation and that I am electronically signing the
            report.</span
          >
        </label>
        <p class="font-mono text-[9px] uppercase leading-relaxed tracking-wide2 text-muted">
          A verification code and QR will be generated. The PDF is rendered server-side.
        </p>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="form.saving.value"
          @click="signOutOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="form.saving.value || missingCount > 0 || !signatureConfirmed"
          @click="confirmSignOut"
        >
          <AppIcon v-if="form.saving.value" name="refresh" :size="13" class="animate-spin" />
          <AppIcon v-else name="lock" :size="13" />
          Sign out report
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="amendOpen"
      title="Sign amendment"
      description="The amendment creates a new immutable version. The reason is retained in the report history and audit trail."
      :persistent="form.saving.value"
    >
      <div class="space-y-4">
        <div class="border border-line bg-canvas p-3 text-xs">
          <p class="text-muted">
            Case <span class="mono text-ink">{{ caseDetail?.accessionNumber }}</span>
          </p>
          <p class="mt-1 text-muted">
            New version <span class="mono text-ink">v{{ (report?.version ?? 0) + 1 }}</span>
          </p>
        </div>
        <FormField
          label="Reason for amendment"
          for-id="amendment-reason"
          required
          hint="At least 10 characters. Be specific and clinically meaningful."
        >
          <textarea
            id="amendment-reason"
            v-model="amendReason"
            class="textarea min-h-[100px]"
            placeholder="Corrected HER2 interpretation after repeat ISH…"
          />
        </FormField>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="form.saving.value"
          @click="amendOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="form.saving.value || amendReason.trim().length < 10"
          @click="confirmAmend"
        >
          <AppIcon v-if="form.saving.value" name="refresh" :size="13" class="animate-spin" />
          <AppIcon v-else name="lock" :size="13" />
          Sign amendment
        </button>
      </template>
    </AppModal>

    <ReportPdfModal
      v-model="pdfOpen"
      :report-id="report?.id ?? null"
      :accession-number="caseDetail?.accessionNumber ?? ''"
    />
  </div>
</template>
