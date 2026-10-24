<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'default' | 'rail' }>(), { variant: 'default' });
const { isDark, toggle } = useTheme();
</script>

<template>
  <button
    type="button"
    class="inline-flex h-8 w-8 items-center justify-center border transition-colors"
    :class="
      variant === 'rail'
        ? 'border-rail-line bg-transparent text-rail-muted hover:border-rail-ink/40 hover:text-rail-ink'
        : 'border-line bg-surface text-muted hover:border-ink hover:text-ink'
    "
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :title="isDark ? 'Light mode' : 'Dark mode'"
    @click="toggle"
  >
    <AppIcon :name="isDark ? 'sun' : 'moon'" :size="15" />
  </button>
</template>
