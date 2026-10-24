<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    forId?: string;
    required?: boolean;
    hint?: string;
    error?: string | null;
    optional?: boolean;
  }>(),
  { required: false, optional: false },
);
</script>

<template>
  <div class="min-w-0">
    <label :for="forId" class="field-label">
      <span>{{ label }}</span>
      <span v-if="required" class="text-accent" aria-hidden="true">*</span>
      <span v-else-if="optional" class="normal-case tracking-normal text-muted/70">optional</span>
    </label>
    <slot />
    <p v-if="hint && !error" class="field-hint">{{ hint }}</p>
    <p v-if="error" class="field-error" role="alert">{{ error }}</p>
  </div>
</template>
