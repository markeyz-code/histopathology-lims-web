<script setup lang="ts">
definePageMeta({ title: 'Access denied' });
useHead({ title: 'Access denied' });
const auth = useAuthStore();
</script>

<template>
  <div>
    <PageHeader
      eyebrow="403 · Access denied"
      title="This door is for another role."
      description="Your account is signed in, but this area is restricted by laboratory policy. If you believe this is wrong, ask the laboratory administrator."
      back-to="/"
      back-label="Back to dashboard"
    />
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="panel p-5">
        <p class="label-caps">You are signed in as</p>
        <p class="mt-2 text-sm font-medium">{{ auth.displayName }}</p>
        <p class="mono mt-1 text-[10px] text-muted">{{ auth.role }}</p>
      </div>
      <div class="panel p-5">
        <p class="label-caps">Laboratory</p>
        <p class="mt-2 text-sm">{{ auth.lab?.name }}</p>
        <p class="mono mt-1 text-[10px] text-muted">{{ auth.lab?.code }}</p>
      </div>
      <div class="panel p-5">
        <p class="label-caps">Need access?</p>
        <p class="mt-2 text-sm text-muted">
          Role changes are audited and require a laboratory administrator.
        </p>
      </div>
    </div>
    <div class="mt-6 flex gap-2">
      <NuxtLink to="/" class="btn btn-primary">Dashboard</NuxtLink>
      <NuxtLink to="/cases" class="btn btn-secondary">Case register</NuxtLink>
    </div>
  </div>
</template>
