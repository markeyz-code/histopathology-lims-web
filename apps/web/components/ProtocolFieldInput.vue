<script setup lang="ts">
import type { ProtocolField, ReportValue } from '@lims/shared';

const props = withDefaults(
  defineProps<{
    field: ProtocolField;
    modelValue: ReportValue | undefined;
    error?: string | null;
    disabled?: boolean;
  }>(),
  { error: null, disabled: false },
);

const emit = defineEmits<{ 'update:modelValue': [value: ReportValue] }>();

const id = useId();

const stringValue = computed(() => (typeof props.modelValue === 'string' ? props.modelValue : ''));
const numberValue = computed(() => (typeof props.modelValue === 'number' ? props.modelValue : ''));
const booleanValue = computed(() =>
  typeof props.modelValue === 'boolean' ? props.modelValue : null,
);
const arrayValue = computed<string[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [],
);

function updateString(event: Event): void {
  emit('update:modelValue', (event.target as HTMLInputElement | HTMLTextAreaElement).value);
}

function updateNumber(event: Event): void {
  const raw = (event.target as HTMLInputElement).value;
  emit('update:modelValue', raw === '' ? null : Number(raw));
}

function toggleOption(value: string): void {
  if (props.disabled) return;
  const set = new Set(arrayValue.value);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  emit('update:modelValue', Array.from(set));
}

function choose(value: boolean): void {
  if (props.disabled) return;
  emit('update:modelValue', booleanValue.value === value ? null : value);
}
</script>

<template>
  <FormField
    :label="field.label"
    :for-id="id"
    :required="field.required"
    :hint="field.help"
    :error="error"
  >
    <template v-if="field.type === 'select'">
      <select
        :id="id"
        class="select"
        :value="stringValue"
        :disabled="disabled"
        :aria-invalid="Boolean(error)"
        @change="updateString"
      >
        <option value="">Select…</option>
        <option v-for="option in field.options ?? []" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </template>

    <template v-else-if="field.type === 'multiselect'">
      <div
        class="flex flex-wrap gap-2 border border-line-strong bg-raised p-2.5"
        role="group"
        :aria-label="field.label"
        :aria-invalid="Boolean(error)"
      >
        <button
          v-for="option in field.options ?? []"
          :key="option.value"
          type="button"
          class="inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-2xs uppercase tracking-wide2 transition-colors"
          :class="
            arrayValue.includes(option.value)
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
          "
          :aria-pressed="arrayValue.includes(option.value)"
          :disabled="disabled"
          @click="toggleOption(option.value)"
        >
          <AppIcon :name="arrayValue.includes(option.value) ? 'check' : 'plus'" :size="10" />
          {{ option.label }}
        </button>
      </div>
    </template>

    <template v-else-if="field.type === 'boolean'">
      <div class="flex gap-2" role="group" :aria-label="field.label">
        <button
          type="button"
          class="btn flex-1 justify-center sm:flex-none"
          :class="
            booleanValue === true ? 'border-emerald-600 bg-emerald-600 text-white' : 'btn-secondary'
          "
          :aria-pressed="booleanValue === true"
          :disabled="disabled"
          @click="choose(true)"
        >
          <AppIcon name="check" :size="12" /> Yes
        </button>
        <button
          type="button"
          class="btn flex-1 justify-center sm:flex-none"
          :class="booleanValue === false ? 'border-ink bg-ink text-canvas' : 'btn-secondary'"
          :aria-pressed="booleanValue === false"
          :disabled="disabled"
          @click="choose(false)"
        >
          <AppIcon name="x" :size="12" /> No
        </button>
      </div>
    </template>

    <template v-else-if="field.type === 'textarea'">
      <textarea
        :id="id"
        class="textarea min-h-[92px] resize-y"
        :value="stringValue"
        :placeholder="field.placeholder"
        :disabled="disabled"
        :aria-invalid="Boolean(error)"
        @input="updateString"
      />
    </template>

    <template v-else-if="field.type === 'number'">
      <div class="relative">
        <input
          :id="id"
          type="number"
          class="input"
          :class="field.unit ? 'pr-14' : ''"
          :value="numberValue"
          :min="field.min"
          :max="field.max"
          step="any"
          :placeholder="field.placeholder"
          :disabled="disabled"
          :aria-invalid="Boolean(error)"
          @input="updateNumber"
        />
        <span
          v-if="field.unit"
          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-2xs uppercase tracking-wide2 text-muted"
        >
          {{ field.unit }}
        </span>
      </div>
    </template>

    <template v-else-if="field.type === 'date'">
      <input
        :id="id"
        type="date"
        class="input"
        :value="stringValue"
        :disabled="disabled"
        :aria-invalid="Boolean(error)"
        @input="updateString"
      />
    </template>

    <template v-else>
      <input
        :id="id"
        type="text"
        class="input"
        :value="stringValue"
        :placeholder="field.placeholder"
        :disabled="disabled"
        :aria-invalid="Boolean(error)"
        @input="updateString"
      />
    </template>
  </FormField>
</template>
