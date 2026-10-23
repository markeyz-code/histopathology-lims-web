<script setup lang="ts">
import type { Protocol, ProtocolContent } from '@lims/shared';
import { SUBSPECIALTIES, protocolContentSchema } from '@lims/shared';

definePageMeta({ title: 'Protocols', capabilities: ['admin'] });
useHead({ title: 'Synoptic protocols' });

const api = useApi();
const toast = useToast();
const { date } = useFormat();

const protocols = ref<Protocol[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const modalOpen = ref(false);
const saving = ref(false);
const formError = ref<string | null>(null);
const editing = ref<Protocol | null>(null);
const originalContent = ref('');

const form = reactive({
  key: '',
  title: '',
  cancerType: '',
  subspecialty: 'Breast',
  active: true,
  content: '',
});

function createTemplate(): string {
  const content: ProtocolContent = {
    schemaVersion: 1,
    title: 'New cancer protocol',
    cancerType: 'Cancer type',
    subspecialty: 'Breast',
    sections: [
      {
        key: 'specimen',
        title: 'Specimen',
        fields: [
          {
            key: 'procedure',
            label: 'Procedure',
            type: 'select',
            required: true,
            options: [
              { value: 'biopsy', label: 'Biopsy' },
              { value: 'resection', label: 'Resection' },
            ],
          },
        ],
      },
      {
        key: 'diagnosis',
        title: 'Diagnosis',
        fields: [
          {
            key: 'diagnosis',
            label: 'Final diagnosis',
            type: 'textarea',
            required: true,
          },
        ],
      },
    ],
  };
  return JSON.stringify(content, null, 2);
}

function openCreate(): void {
  editing.value = null;
  form.key = '';
  form.title = '';
  form.cancerType = '';
  form.subspecialty = 'Breast';
  form.active = true;
  form.content = createTemplate();
  originalContent.value = form.content;
  formError.value = null;
  modalOpen.value = true;
}

function openEdit(protocol: Protocol): void {
  editing.value = protocol;
  form.key = protocol.key;
  form.title = protocol.title;
  form.cancerType = protocol.cancerType;
  form.subspecialty = protocol.subspecialty;
  form.active = protocol.active;
  form.content = JSON.stringify(protocol.content, null, 2);
  originalContent.value = form.content;
  formError.value = null;
  modalOpen.value = true;
}

function parseContent(): ProtocolContent | null {
  let raw: unknown;
  try {
    raw = JSON.parse(form.content);
  } catch {
    formError.value = 'Content is not valid JSON.';
    return null;
  }
  const parsed = protocolContentSchema.safeParse(raw);
  if (!parsed.success) {
    formError.value = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'content'}: ${issue.message}`)
      .join(' · ');
    return null;
  }
  return parsed.data;
}

async function submit(): Promise<void> {
  formError.value = null;
  const content = parseContent();
  if (!content) return;
  saving.value = true;
  try {
    if (editing.value) {
      const patch: Record<string, unknown> = {
        title: form.title,
        cancerType: form.cancerType,
        subspecialty: form.subspecialty,
        active: form.active,
      };
      if (form.content !== originalContent.value) patch.content = content;
      await api.patch<Protocol>(`/protocols/${editing.value.id}`, patch);
      toast.success(
        'Protocol updated',
        patch.content ? 'A new protocol version has been created.' : 'Metadata updated.',
      );
    } else {
      await api.post<Protocol>('/protocols', {
        key: form.key,
        title: form.title,
        cancerType: form.cancerType,
        subspecialty: form.subspecialty,
        content,
      });
      toast.success('Protocol created', form.title);
    }
    modalOpen.value = false;
    await load();
  } catch (caught) {
    formError.value = apiErrorMessage(caught);
  } finally {
    saving.value = false;
  }
}

async function deactivate(protocol: Protocol): Promise<void> {
  if (!window.confirm(`Deactivate “${protocol.title}”? Existing reports keep their snapshot.`))
    return;
  try {
    await api.del<Protocol>(`/protocols/${protocol.id}`);
    toast.success('Protocol deactivated', protocol.title);
    await load();
  } catch (caught) {
    toast.error('Could not deactivate protocol', apiErrorMessage(caught));
  }
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    protocols.value = await api.get<Protocol[]>('/protocols');
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="Synoptic protocols"
      description="Schema-driven templates for cancer reporting. Content changes increment the version; signed reports keep their original snapshot."
    >
      <template #actions>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <AppIcon name="plus" :size="13" /> New protocol
        </button>
      </template>
      <template #meta>
        <span class="mono">{{ protocols.length }} protocols</span>
        <span>{{ protocols.filter((p) => p.active).length }} active</span>
      </template>
    </PageHeader>

    <AdminNav />

    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" kind="cards" :rows="4" />
    <EmptyState
      v-else-if="protocols.length === 0"
      icon="protocols"
      title="No protocols configured"
      message="Create a JSON-schema protocol to enable synoptic reporting."
    >
      <button type="button" class="btn btn-primary" @click="openCreate">New protocol</button>
    </EmptyState>

    <div v-else class="grid gap-4 lg:grid-cols-2">
      <article v-for="protocol in protocols" :key="protocol.id" class="panel flex flex-col p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="label-caps">{{ protocol.subspecialty }}</p>
            <h2 class="display mt-1.5 text-xl">{{ protocol.title }}</h2>
            <p class="mt-1 text-xs text-muted">{{ protocol.cancerType }}</p>
          </div>
          <span
            class="shrink-0 border px-2 py-1 font-mono text-[9px] uppercase tracking-wide2"
            :class="
              protocol.active
                ? 'border-success/40 bg-success/10 text-success'
                : 'border-line bg-canvas text-muted'
            "
          >
            {{ protocol.active ? 'Active' : 'Inactive' }}
          </span>
        </div>
        <div
          class="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[9px] uppercase tracking-wide2 text-muted"
        >
          <span>{{ protocol.key }}</span>
          <span>v{{ protocol.version }}</span>
          <span>{{ protocol.content.sections.length }} sections</span>
          <span
            >{{
              protocol.content.sections.reduce((sum, section) => sum + section.fields.length, 0)
            }}
            fields</span
          >
          <span>updated {{ date(protocol.updatedAt) }}</span>
        </div>
        <div class="mt-4 space-y-1 border-t border-line pt-3 text-[11px] text-muted">
          <p v-for="section in protocol.content.sections.slice(0, 5)" :key="section.key">
            <span class="text-ink">{{ section.title }}</span> · {{ section.fields.length }} fields
          </p>
        </div>
        <div class="mt-4 flex items-center gap-2 border-t border-line pt-3">
          <button type="button" class="btn btn-secondary btn-sm" @click="openEdit(protocol)">
            <AppIcon name="edit" :size="11" /> Edit JSON
          </button>
          <button
            v-if="protocol.active"
            type="button"
            class="btn btn-ghost btn-sm text-danger"
            @click="deactivate(protocol)"
          >
            Deactivate
          </button>
        </div>
      </article>
    </div>

    <AppModal
      v-model="modalOpen"
      :title="editing ? 'Edit protocol' : 'New synoptic protocol'"
      description="Protocol content is validated against the shared Zod schema. Fields are rendered dynamically in the report editor."
      size="xl"
      :persistent="saving"
    >
      <div
        v-if="formError"
        class="mb-4 border border-danger/40 bg-danger/[0.05] p-3 text-xs text-danger"
        role="alert"
      >
        {{ formError }}
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField
          label="Key"
          for-id="protocol-key"
          required
          :hint="editing ? 'Immutable' : 'lower_snake_case'"
        >
          <input
            id="protocol-key"
            v-model="form.key"
            class="input mono"
            :disabled="Boolean(editing)"
            placeholder="breast_carcinoma"
          />
        </FormField>
        <FormField label="Title" for-id="protocol-title" required>
          <input
            id="protocol-title"
            v-model="form.title"
            class="input"
            placeholder="Breast carcinoma — synoptic report"
          />
        </FormField>
        <FormField label="Cancer type" for-id="protocol-cancer" required>
          <input
            id="protocol-cancer"
            v-model="form.cancerType"
            class="input"
            placeholder="Invasive breast carcinoma"
          />
        </FormField>
        <FormField label="Subspecialty" for-id="protocol-subspecialty" required>
          <select id="protocol-subspecialty" v-model="form.subspecialty" class="select">
            <option
              v-for="subspecialty in SUBSPECIALTIES"
              :key="subspecialty"
              :value="subspecialty"
            >
              {{ subspecialty }}
            </option>
          </select>
        </FormField>
        <label v-if="editing" class="flex items-center gap-2 text-xs sm:col-span-2">
          <input
            v-model="form.active"
            type="checkbox"
            class="h-4 w-4 accent-[rgb(var(--accent))]"
          />
          Active protocol
        </label>
      </div>
      <div class="mt-4">
        <FormField
          label="Protocol content (JSON)"
          for-id="protocol-content"
          required
          hint="Sections → fields. Types: text, textarea, select, multiselect, number, boolean, date."
        >
          <textarea
            id="protocol-content"
            v-model="form.content"
            class="textarea min-h-[380px] font-mono text-[11px] leading-relaxed"
            spellcheck="false"
          />
        </FormField>
      </div>
      <template #footer>
        <button type="button" class="btn btn-ghost" :disabled="saving" @click="modalOpen = false">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="submit">
          <AppIcon v-if="saving" name="refresh" :size="13" class="animate-spin" />
          <AppIcon v-else name="save" :size="13" />
          {{ editing ? 'Save protocol' : 'Create protocol' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
