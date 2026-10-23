<script setup lang="ts">
const { isOnline } = useNetwork();
</script>

<template>
  <div>
    <a href="#main-content" class="skip-link">Skip to main content</a>
    <NuxtLoadingIndicator :height="2" color="rgb(184 57 29)" />
    <div
      v-if="!isOnline"
      class="fixed inset-x-0 top-0 z-[95] border-b border-warning/40 bg-warning px-4 py-1.5 text-center font-mono text-2xs uppercase tracking-caps text-white"
      role="status"
    >
      Offline — clinical actions are paused. Previously loaded pages remain visible.
    </div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ToastStack />
  </div>
</template>
