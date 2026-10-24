<script setup lang="ts">
import type { CodingSystem, Paginated, ReportCoding, TerminologyCode } from '@lims/shared';
import { CODING_SYSTEMS, CODING_SYSTEM_LABELS } from '@lims/shared';

const props = defineProps<{ modelValue: ReportCoding; disabled?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: ReportCoding] }>();
const api = useApi();
const options = reactive<Record<CodingSystem, TerminologyCode[]>>({
  SNOMED_CT: [],
  ICD_O_3_MORPHOLOGY: [],
  ICD_O_3_TOPOGRAPHY: [],
});
const loading = ref(true);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const results = await Promise.all(
      CODING_SYSTEMS.map(async (system) => {
        const result = await api.get<Paginated<TerminologyCode>>('/terminology/search', {
          system,
          limit: 50,
        });
        return [system, result.items] as const;
      }),
    );
    for (const [system, items] of results) options[system] = items;
  } catch {
    // The coding card degrades to blank selects; report editing remains available.
  } finally {
    loading.value = false;
  }
}

const fields = [
  {
    system: 'SNOMED_CT' as const,
    codeKey: 'snomedCode' as const,
    displayKey: 'snomedDisplay' as const,
    hint: 'Diagnosis concept',
  },
  {
    system: 'ICD_O_3_MORPHOLOGY' as const,
    codeKey: 'icdo3MorphologyCode' as const,
    displayKey: 'icdo3MorphologyDisplay' as const,
    hint: 'Morphology',
  },
  {
    system: 'ICD_O_3_TOPOGRAPHY' as const,
    codeKey: 'icdo3TopographyCode' as const,
    displayKey: 'icdo3TopographyDisplay' as const,
    hint: 'Topography',
  },
];

function codingOptions(system: CodingSystem) {
  return [
    { value: '', label: 'Not coded' },
    ...options[system].map((option) => ({
      value: option.code,
      label: `${option.code} · ${option.display}`,
      keywords: option.display,
    })),
  ];
}

function choose(system: CodingSystem, code: string): void {
  const entry = options[system].find((item) => item.code === code);
  const next: ReportCoding = { ...props.modelValue };
  const field = fields.find((item) => item.system === system);
  if (!field) return;
  next[field.codeKey] = entry?.code ?? null;
  next[field.displayKey] = entry?.display ?? null;
  emit('update:modelValue', next);
}

onMounted(load);
</script>

<template>
  <section class="panel p-5 sm:p-6">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p class="label-caps">Clinical coding</p>
        <h2 class="mt-1 text-xl">SNOMED CT &amp; ICD-O-3</h2>
        <p class="mt-1 text-xs leading-relaxed text-muted">
          Validated against the laboratory's licensed subset. Codes flow into FHIR and the PDF.
        </p>
      </div>
      <span v-if="loading" class="font-mono text-[9px] uppercase tracking-caps text-muted"
        >Loading…</span
      >
    </div>
    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div v-for="field in fields" :key="field.system">
        <label :for="`coding-${field.system}`" class="label-caps">{{
          CODING_SYSTEM_LABELS[field.system]
        }}</label>
        <SearchSelect
          :id="`coding-${field.system}`"
          class="mt-1.5"
          :model-value="props.modelValue[field.codeKey] ?? ''"
          :options="codingOptions(field.system)"
          :disabled="disabled || loading"
          placeholder="Not coded"
          search-placeholder="Search code or description…"
          @update:model-value="choose(field.system, String($event))"
        />
        <p class="mt-1.5 line-clamp-2 text-[10px] text-muted">
          {{ props.modelValue[field.displayKey] ?? `${field.hint} not selected` }}
        </p>
      </div>
    </div>
  </section>
</template>
