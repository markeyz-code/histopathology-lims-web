<script setup lang="ts">
import type { Paginated, User } from '@lims/shared';
import type { Discipline } from '@lims/shared';
import { DISCIPLINE_LABELS } from '@lims/shared';

definePageMeta({ title: 'Laboratory configuration', capabilities: ['admin'] });
useHead({ title: 'Laboratory configuration' });

const api = useApi();
const auth = useAuthStore();
const users = ref<User[]>([]);
const catalogCount = ref(0);
const loading = ref(true);

async function load(): Promise<void> {
  loading.value = true;
  try {
    const [staff, tests] = await Promise.all([
      api.get<Paginated<User>>('/users', { limit: 100 }).catch(() => ({ items: [], total: 0 })),
      api
        .get<Paginated<unknown>>('/catalog/tests', { limit: 1 })
        .catch(() => ({ items: [], total: 0 })),
    ]);
    users.value = staff.items;
    catalogCount.value = tests.total;
  } finally {
    loading.value = false;
  }
}

function disciplineNames(values: Discipline[]): string {
  return values.map((value) => DISCIPLINE_LABELS[value]).join(' · ');
}

const checklist = computed(() => [
  {
    label: 'Laboratory profile and letterhead',
    done: Boolean(auth.lab?.name && auth.lab?.letterhead?.pathologistName),
    to: '/admin/settings',
    hint: 'Name, address, report signatory and footer.',
  },
  {
    label: 'Disciplines enabled',
    done: (auth.lab?.enabledDisciplines.length ?? 0) > 0,
    to: '/admin/settings',
    hint: 'Only the services this laboratory actually offers.',
  },
  {
    label: 'Starter test catalogue',
    done: catalogCount.value > 0,
    to: '/admin/catalog',
    hint: 'Tests, analytes, reference ranges and panels.',
  },
  {
    label: 'Laboratory team invited',
    done: users.value.length > 1,
    to: '/admin/users',
    hint: 'Add scientists, pathologists and reception staff.',
  },
  {
    label: 'Reporting rules reviewed',
    done: false,
    to: '/admin/rules',
    hint: 'Critical, reflex and auto-verification behaviour.',
  },
  {
    label: 'Integrations and billing',
    done: false,
    to: '/admin/integrations',
    hint: 'Instruments, FHIR/HL7 and payment configuration.',
  },
]);

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="Laboratory configuration"
      description="Your laboratory is an isolated tenant. Configure its services, people, catalogue, reporting rules and integrations here."
    >
      <template #actions
        ><NuxtLink to="/admin/settings" class="btn btn-primary"
          ><AppIcon name="settings" :size="13" /> Open settings</NuxtLink
        ></template
      >
      <template #meta
        ><span>{{ auth.lab?.code }}</span
        ><span>{{ disciplineNames(auth.lab?.enabledDisciplines ?? []) }}</span></template
      >
    </PageHeader>
    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
      <section class="panel">
        <div class="border-b border-line px-5 py-4">
          <p class="label-caps">Setup checklist</p>
          <p class="mt-1 text-xs text-muted">
            Complete these before going live. Each item is reversible and audited.
          </p>
        </div>
        <div class="divide-y divide-line">
          <NuxtLink
            v-for="item in checklist"
            :key="item.label"
            :to="item.to"
            class="flex items-center gap-4 px-5 py-4 hover:bg-raised"
          >
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center border"
              :class="
                item.done
                  ? 'border-success/40 bg-success/10 text-success'
                  : 'border-line text-muted'
              "
              ><AppIcon :name="item.done ? 'check' : 'chevron-right'" :size="13"
            /></span>
            <span class="min-w-0"
              ><span class="block text-sm font-medium">{{ item.label }}</span
              ><span class="mt-0.5 block text-[11px] text-muted">{{ item.hint }}</span></span
            >
          </NuxtLink>
        </div>
      </section>
      <aside class="space-y-4">
        <section class="panel p-5">
          <p class="label-caps">Configuration areas</p>
          <nav class="mt-3 grid gap-1">
            <NuxtLink
              to="/admin/users"
              class="flex items-center gap-2 px-2 py-2 text-sm hover:bg-raised"
              ><AppIcon name="users" :size="14" /> Staff and roles</NuxtLink
            ><NuxtLink
              to="/admin/catalog"
              class="flex items-center gap-2 px-2 py-2 text-sm hover:bg-raised"
              ><AppIcon name="beaker" :size="14" /> Test catalogue</NuxtLink
            ><NuxtLink
              to="/admin/rules"
              class="flex items-center gap-2 px-2 py-2 text-sm hover:bg-raised"
              ><AppIcon name="shield" :size="14" /> Rules engine</NuxtLink
            ><NuxtLink
              to="/admin/protocols"
              class="flex items-center gap-2 px-2 py-2 text-sm hover:bg-raised"
              ><AppIcon name="protocols" :size="14" /> Synoptic protocols</NuxtLink
            ><NuxtLink
              to="/admin/integrations"
              class="flex items-center gap-2 px-2 py-2 text-sm hover:bg-raised"
              ><AppIcon name="external" :size="14" /> Integrations</NuxtLink
            ><NuxtLink
              to="/admin/billing"
              class="flex items-center gap-2 px-2 py-2 text-sm hover:bg-raised"
              ><AppIcon name="billing" :size="14" /> Billing</NuxtLink
            >
          </nav>
        </section>
        <section class="panel p-5">
          <p class="label-caps">Tenant summary</p>
          <p class="mt-2 text-sm font-medium">{{ auth.lab?.name }}</p>
          <p class="mono mt-1 text-[10px] text-muted">
            {{ auth.lab?.code }} · {{ auth.lab?.currency }} · {{ auth.lab?.timezone }}
          </p>
          <p class="mt-2 text-[11px] text-muted">
            {{ users.length }} users · {{ catalogCount }} tests
          </p>
        </section>
      </aside>
    </div>
  </div>
</template>
