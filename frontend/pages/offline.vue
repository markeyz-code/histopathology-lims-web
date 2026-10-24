<script setup lang="ts">
definePageMeta({ layout: 'auth', title: 'Offline' });
useHead({ title: 'Offline' });
function reload(): void {
  location.reload();
}
</script>

<template>
  <div class="text-center">
    <div
      class="mx-auto flex h-14 w-14 items-center justify-center border border-line-strong bg-surface text-muted"
    >
      <AppIcon name="wifi-off" :size="26" />
    </div>
    <p class="label-caps mt-5">Connection interrupted</p>
    <h1 class="display mt-3 text-4xl leading-tight">The laboratory is offline.</h1>
    <p class="mt-3 text-sm leading-relaxed text-muted">
      The application shell is cached so this screen loads without a network. Clinical actions are
      paused until the connection returns — the custody ledger is never written speculatively.
    </p>
    <button type="button" class="btn btn-primary mt-6" @click="reload">
      <AppIcon name="refresh" :size="13" /> Try again
    </button>
    <p class="mt-5 font-mono text-[9px] uppercase tracking-wide2 text-muted">
      Offline-first sync arrives in Phase 3
    </p>
  </div>
</template>
