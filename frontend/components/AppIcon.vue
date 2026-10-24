<script setup lang="ts">
import { iconPaths, type IconName } from '~/types/icons';

const props = withDefaults(
  defineProps<{
    name: IconName;
    size?: number | string;
    strokeWidth?: number;
  }>(),
  { size: 18, strokeWidth: 1.7 },
);
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="props.strokeWidth"
    stroke-linecap="square"
    stroke-linejoin="miter"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(path, index) in iconPaths[props.name]" :key="index" :d="path" />
  </svg>
</template>
