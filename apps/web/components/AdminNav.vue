<script setup lang="ts">
const route = useRoute();
import type { Capability } from '@lims/shared';

const auth = useAuthStore();
const tabs: Array<{
  to: string;
  label: string;
  icon: 'users' | 'protocols' | 'settings' | 'audit' | 'beaker' | 'billing' | 'send' | 'external';
  capability: Capability;
}> = [
  { to: '/admin/users', label: 'Users', icon: 'users', capability: 'admin' },
  { to: '/admin/protocols', label: 'Protocols', icon: 'protocols', capability: 'admin' },
  { to: '/admin/settings', label: 'Lab settings', icon: 'settings', capability: 'admin' },
  { to: '/admin/inventory', label: 'Inventory', icon: 'beaker', capability: 'inventory' },
  { to: '/admin/billing', label: 'Billing', icon: 'billing', capability: 'billing' },
  { to: '/admin/notifications', label: 'Outbox', icon: 'send', capability: 'admin' },
  { to: '/admin/integrations', label: 'Integrations', icon: 'external', capability: 'interop' },
  { to: '/admin/audit', label: 'Audit log', icon: 'audit', capability: 'audit' },
];
const visible = computed(() => tabs.filter((tab) => auth.can(tab.capability)));
</script>

<template>
  <nav
    class="mb-6 flex gap-0 overflow-x-auto border-b border-line no-scrollbar"
    aria-label="Administration"
  >
    <NuxtLink
      v-for="tab in visible"
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
