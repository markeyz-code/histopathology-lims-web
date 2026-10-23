<script setup lang="ts">
import { ROLE_LABELS } from '@lims/shared';
import type { Capability } from '@lims/shared';
import type { IconName } from '~/types/icons';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const mobileOpen = ref(false);
const quickSearch = ref('');
const searchInput = ref<HTMLInputElement | null>(null);

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  capability: Capability;
  exact?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: 'Work',
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard', capability: 'dashboard', exact: true },
      { to: '/accession', label: 'Accession', icon: 'plus', capability: 'accession' },
      { to: '/cases', label: 'Cases', icon: 'cases', capability: 'cases' },
      { to: '/scan', label: 'Scan station', icon: 'scan', capability: 'scan' },
      { to: '/worklist', label: 'Worklist', icon: 'worklist', capability: 'worklist' },
      { to: '/qa', label: 'QA review', icon: 'shield', capability: 'qa' },
      { to: '/admin/billing', label: 'Billing', icon: 'billing', capability: 'billing' },
    ],
  },
  {
    label: 'Locate',
    items: [{ to: '/locator', label: 'Specimen locator', icon: 'search', capability: 'locator' }],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/users', label: 'Staff', icon: 'users', capability: 'admin' },
      { to: '/admin/protocols', label: 'Protocols', icon: 'protocols', capability: 'admin' },
      { to: '/admin/inventory', label: 'Inventory', icon: 'beaker', capability: 'inventory' },
      { to: '/admin/notifications', label: 'Message outbox', icon: 'send', capability: 'admin' },
      { to: '/admin/integrations', label: 'Integrations', icon: 'external', capability: 'interop' },
      { to: '/admin/settings', label: 'Lab settings', icon: 'settings', capability: 'admin' },
      { to: '/admin/audit', label: 'Audit log', icon: 'audit', capability: 'audit' },
    ],
  },
];

const visibleSections = computed(() =>
  sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => auth.can(item.capability)),
    }))
    .filter((section) => section.items.length > 0),
);

const pageTitle = computed(() => (typeof route.meta.title === 'string' ? route.meta.title : ''));

function isActive(item: NavItem): boolean {
  if (item.exact) return route.path === item.to;
  return route.path === item.to || route.path.startsWith(`${item.to}/`);
}

function submitSearch(): void {
  const query = quickSearch.value.trim();
  if (!query) return;
  void router.push({ path: '/locator', query: { q: query } });
  quickSearch.value = '';
}

async function signOut(): Promise<void> {
  await auth.logout();
  await router.push('/login');
}

function onKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
  if (event.key === '/' && !typing) {
    event.preventDefault();
    searchInput.value?.focus();
  }
}

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
  },
);

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="min-h-screen bg-canvas">
    <aside
      class="fixed inset-y-0 left-0 z-40 hidden w-[238px] flex-col border-r border-rail-line bg-rail text-rail-ink lg:flex"
    >
      <div class="border-b border-rail-line px-5 py-5">
        <AppWordmark variant="rail" />
        <div class="mt-4 border-l-2 border-accent pl-3">
          <p
            class="line-clamp-2 text-[10px] font-medium leading-snug text-rail-ink"
            :title="auth.lab?.name"
          >
            {{ auth.lab?.name ?? 'Laboratory' }}
          </p>
          <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-rail-muted">
            {{ auth.lab?.code ?? '—' }} · {{ auth.lab?.timezone ?? 'Africa/Lagos' }}
          </p>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto py-3 scroll-area" aria-label="Primary">
        <div v-for="section in visibleSections" :key="section.label" class="mb-4 last:mb-0">
          <p class="px-4 pb-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-rail-muted/70">
            {{ section.label }}
          </p>
          <NuxtLink
            v-for="item in section.items"
            :key="item.to"
            :to="item.to"
            class="nav-item"
            :class="{ 'nav-item-active': isActive(item) }"
          >
            <AppIcon :name="item.icon" :size="15" />
            <span>{{ item.label }}</span>
            <span v-if="isActive(item)" class="ml-auto h-1.5 w-1.5 bg-accent" aria-hidden="true" />
          </NuxtLink>
        </div>
      </nav>

      <div class="border-t border-rail-line p-3">
        <div class="flex items-center gap-2.5 px-1 py-2">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center border border-rail-line bg-rail-ink/5 font-mono text-[10px] text-rail-ink"
          >
            {{ auth.initials }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-[11px] font-medium text-rail-ink">{{ auth.displayName }}</p>
            <p class="truncate font-mono text-[8px] uppercase tracking-[0.12em] text-rail-muted">
              {{ auth.role ? ROLE_LABELS[auth.role] : '' }}
            </p>
          </div>
        </div>
        <div class="mt-1 flex items-center gap-1">
          <button
            type="button"
            class="flex flex-1 items-center gap-2 border border-rail-line px-2 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-rail-muted transition-colors hover:border-rail-ink/40 hover:text-rail-ink"
            @click="signOut"
          >
            <AppIcon name="logout" :size="12" />
            Sign out
          </button>
          <ThemeToggle variant="rail" />
        </div>
      </div>
    </aside>

    <div class="lg:pl-[238px]">
      <header class="sticky top-0 z-30 border-b border-line bg-canvas/95 backdrop-blur-sm">
        <div class="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center border border-line bg-surface text-ink lg:hidden"
            aria-label="Open navigation"
            @click="mobileOpen = true"
          >
            <AppIcon name="menu" :size="18" />
          </button>

          <NuxtLink
            to="/"
            class="flex h-9 w-9 shrink-0 items-center justify-center bg-accent font-display text-base text-accent-ink lg:hidden"
            aria-label="Dashboard"
          >
            H
          </NuxtLink>

          <p
            class="hidden min-w-0 items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted sm:flex"
          >
            <span class="text-accent">●</span>
            <span class="truncate">{{ pageTitle || 'Histopathology LIMS' }}</span>
          </p>

          <form
            class="ml-auto flex w-full max-w-[280px] items-center gap-2"
            @submit.prevent="submitSearch"
          >
            <label for="global-locator" class="sr-only">Find a block or slide by barcode</label>
            <div class="relative w-full">
              <AppIcon
                name="search"
                :size="14"
                class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="global-locator"
                ref="searchInput"
                v-model="quickSearch"
                type="search"
                class="input input-sm w-full pl-8 pr-12 font-mono text-[11px] uppercase placeholder:normal-case placeholder:tracking-normal"
                placeholder="Find block / slide…"
                autocomplete="off"
                spellcheck="false"
              />
              <span class="kbd pointer-events-none absolute right-2 top-1/2 -translate-y-1/2"
                >/</span
              >
            </div>
          </form>

          <div class="flex items-center gap-2">
            <OfflineQueueBadge />
            <NuxtLink
              v-if="auth.can('accession')"
              to="/accession"
              class="btn btn-primary btn-sm hidden sm:inline-flex"
            >
              <AppIcon name="plus" :size="12" />
              New case
            </NuxtLink>
          </div>
        </div>
      </header>

      <main id="main-content" class="mx-auto w-full max-w-shell px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <slot />
      </main>

      <footer
        class="mx-auto flex w-full max-w-shell flex-col gap-1 border-t border-line px-4 py-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"
      >
        <span>Histopathology LIMS · Phase 2/3</span>
        <span>{{ auth.lab?.name }} · {{ auth.lab?.code }}</span>
      </footer>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition duration-100 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="mobileOpen"
          class="overlay fixed inset-0 z-[70] lg:hidden"
          @click.self="mobileOpen = false"
        >
          <aside class="flex h-full w-[282px] flex-col bg-rail text-rail-ink animate-scan-in">
            <div class="flex items-center justify-between border-b border-rail-line px-5 py-5">
              <AppWordmark variant="rail" compact />
              <button
                type="button"
                class="text-rail-muted hover:text-rail-ink"
                aria-label="Close navigation"
                @click="mobileOpen = false"
              >
                <AppIcon name="close" :size="18" />
              </button>
            </div>
            <div class="border-b border-rail-line px-5 py-4">
              <p class="line-clamp-2 text-[10px] leading-snug text-rail-ink">
                {{ auth.lab?.name }}
              </p>
              <p class="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-rail-muted">
                {{ auth.lab?.code }}
              </p>
            </div>
            <nav class="flex-1 overflow-y-auto py-3" aria-label="Mobile primary">
              <div v-for="section in visibleSections" :key="section.label" class="mb-4">
                <p
                  class="px-4 pb-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-rail-muted/70"
                >
                  {{ section.label }}
                </p>
                <NuxtLink
                  v-for="item in section.items"
                  :key="item.to"
                  :to="item.to"
                  class="nav-item"
                  :class="{ 'nav-item-active': isActive(item) }"
                >
                  <AppIcon :name="item.icon" :size="15" />
                  {{ item.label }}
                </NuxtLink>
              </div>
            </nav>
            <div class="border-t border-rail-line p-3">
              <div class="mb-2 px-1">
                <p class="text-[11px] text-rail-ink">{{ auth.displayName }}</p>
                <p class="font-mono text-[8px] uppercase tracking-[0.14em] text-rail-muted">
                  {{ auth.role ? ROLE_LABELS[auth.role] : '' }}
                </p>
              </div>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="btn btn-ghost flex-1 justify-start border border-rail-line text-rail-muted hover:text-rail-ink"
                  @click="signOut"
                >
                  <AppIcon name="logout" :size="12" /> Sign out
                </button>
                <ThemeToggle variant="rail" />
              </div>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
