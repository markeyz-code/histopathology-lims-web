<script setup lang="ts">
const route = useRoute();
const tabs = [
  { to: '/admin/users', label: 'Users', icon: 'users' as const },
  { to: '/admin/protocols', label: 'Protocols', icon: 'protocols' as const },
  { to: '/admin/settings', label: 'Lab settings', icon: 'settings' as const },
  { to: '/admin/audit', label: 'Audit log', icon: 'audit' as const },
];
</script>

<template>
  <nav
    class="mb-6 flex gap-0 overflow-x-auto border-b border-line no-scrollbar"
    aria-label="Administration"
  >
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-mono text-2xs uppercase tracking-caps transition-colors"
      :class="
        route.path === tab.to
          ? 'border-accent text-ink'
          : 'border-transparent text-muted hover:text-ink'
      "
    >
      <AppIcon :name="tab.icon" :size="14" />
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>
