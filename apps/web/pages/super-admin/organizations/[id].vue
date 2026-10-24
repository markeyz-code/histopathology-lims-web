<script setup lang="ts">
import type { OrganizationDetail } from '@lims/shared';
import type { Discipline } from '@lims/shared';
import { DISCIPLINES, DISCIPLINE_LABELS } from '@lims/shared';

definePageMeta({ title: 'Organization', capabilities: ['platform'] });
useHead({ title: 'Organization · Platform' });
const route = useRoute();
const api = useApi();
const toast = useToast();
const { dateTime } = useFormat();
const org = ref<OrganizationDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const labOpen = ref(false);
const adminOpen = ref(false);
const adminLab = ref('');
const saving = ref(false);
const inviteUrl = ref<string | null>(null);
const selectedDisciplines = ref<string[]>(['HISTOPATHOLOGY']);
const labForm = reactive({
  code: '',
  name: '',
  address: '',
  phone: '',
  email: '',
  accessionPrefix: 'HP',
  timezone: 'Africa/Lagos',
  currency: 'NGN',
  qaSamplingPercent: 10,
});
const adminForm = reactive({ name: '', email: '', phone: '' });

function disciplineNames(values: Discipline[]): string {
  return values.map((value) => DISCIPLINE_LABELS[value]).join(' · ');
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    org.value = await api.get<OrganizationDetail>(`/super-admin/organizations/${route.params.id}`);
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function setStatus(status: string): Promise<void> {
  saving.value = true;
  try {
    await api.patch(`/super-admin/organizations/${route.params.id}`, { status });
    toast.success('Organization updated', status);
    await load();
  } catch (caught) {
    toast.error('Could not update', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function addLab(): Promise<void> {
  saving.value = true;
  try {
    await api.post(`/super-admin/organizations/${route.params.id}/labs`, {
      ...labForm,
      enabledDisciplines: selectedDisciplines.value,
    });
    labOpen.value = false;
    toast.success('Laboratory provisioned', labForm.name);
    await load();
  } catch (caught) {
    toast.error('Could not provision laboratory', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

function openAdmin(labId: string): void {
  adminLab.value = labId;
  adminForm.name = '';
  adminForm.email = '';
  inviteUrl.value = null;
  adminOpen.value = true;
}

async function invite(): Promise<void> {
  saving.value = true;
  try {
    const result = await api.post<{ email: string; inviteUrl: string }>(
      `/super-admin/labs/${adminLab.value}/invite-admin`,
      adminForm,
    );
    inviteUrl.value = result.inviteUrl;
    toast.success('Administrator invited', result.email);
  } catch (caught) {
    toast.error('Could not invite administrator', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function toggleLab(labId: string, active: boolean): Promise<void> {
  try {
    await api.patch(`/super-admin/labs/${labId}/status`, { active });
    await load();
  } catch (caught) {
    toast.error('Could not update laboratory', apiErrorMessage(caught));
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Platform / Organization"
      title="Organization control"
      description="Manage laboratories, plans, administrators and lifecycle for this tenant."
    >
      <template #actions
        ><NuxtLink to="/super-admin" class="btn btn-secondary"
          ><AppIcon name="arrow-left" :size="13" /> All organizations</NuxtLink
        ></template
      >
    </PageHeader>
    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="8" />
    <template v-else-if="org">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <div class="space-y-4">
          <section class="panel p-5">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <h2 class="display text-2xl">{{ org.name }}</h2>
                  <span
                    class="font-mono text-[9px] uppercase"
                    :class="
                      org.status === 'ACTIVE'
                        ? 'text-success'
                        : org.status === 'SUSPENDED'
                          ? 'text-danger'
                          : 'text-warning'
                    "
                    >{{ org.status }}</span
                  >
                </div>
                <p class="mono mt-1 text-[10px] text-muted">
                  {{ org.code }} · {{ org.type }} · {{ org.country
                  }}{{ org.state ? ' / ' + org.state : '' }}
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  v-if="org.status !== 'ACTIVE'"
                  type="button"
                  class="btn btn-secondary btn-sm"
                  :disabled="saving"
                  @click="setStatus('ACTIVE')"
                >
                  Activate</button
                ><button
                  v-if="org.status !== 'SUSPENDED'"
                  type="button"
                  class="btn btn-ghost btn-sm text-danger"
                  :disabled="saving"
                  @click="setStatus('SUSPENDED')"
                >
                  Suspend
                </button>
              </div>
            </div>
            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p class="label-caps">Plan</p>
                <p class="mt-1 text-sm">{{ org.plan }}</p>
              </div>
              <div>
                <p class="label-caps">Seats</p>
                <p class="mt-1 text-sm">{{ org.userCount }} / {{ org.seats }}</p>
              </div>
              <div>
                <p class="label-caps">Laboratories</p>
                <p class="mt-1 text-sm">{{ org.labs.length }}</p>
              </div>
              <div>
                <p class="label-caps">Cases</p>
                <p class="mt-1 text-sm">{{ org.caseCount }}</p>
              </div>
            </div>
            <p v-if="org.email || org.phone" class="mt-4 text-xs text-muted">
              {{ org.email ?? '' }}<span v-if="org.email && org.phone"> · </span
              >{{ org.phone ?? '' }}
            </p>
            <p v-if="org.trialEndsAt" class="mt-1 text-[11px] text-warning">
              Trial ends {{ dateTime(org.trialEndsAt) }}
            </p>
          </section>

          <section class="panel">
            <div class="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <p class="label-caps">Laboratories</p>
                <p class="mt-1 text-xs text-muted">
                  Each laboratory is an isolated tenant with its own admin configuration.
                </p>
              </div>
              <button type="button" class="btn btn-primary btn-sm" @click="labOpen = true">
                <AppIcon name="plus" :size="12" /> Add laboratory
              </button>
            </div>
            <div class="divide-y divide-line">
              <div
                v-for="lab in org.labs"
                :key="lab.id"
                class="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p class="text-sm font-medium">{{ lab.name }}</p>
                  <p class="mono mt-0.5 text-[9px] text-muted">
                    {{ lab.code }} · {{ disciplineNames(lab.enabledDisciplines) }}
                  </p>
                  <p class="mt-1 text-[10px] text-muted">
                    {{ lab.userCount }} users · {{ lab.caseCount }} cases
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="font-mono text-[9px] uppercase"
                    :class="lab.active ? 'text-success' : 'text-danger'"
                    >{{ lab.active ? 'Active' : 'Suspended' }}</span
                  ><button type="button" class="btn btn-ghost btn-sm" @click="openAdmin(lab.id)">
                    Invite admin</button
                  ><button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    @click="toggleLab(lab.id, !lab.active)"
                  >
                    {{ lab.active ? 'Suspend' : 'Restore' }}
                  </button>
                </div>
              </div>
              <p v-if="org.labs.length === 0" class="p-4 text-xs text-muted">
                No laboratories yet.
              </p>
            </div>
          </section>
        </div>
        <aside class="panel h-fit">
          <div class="border-b border-line px-4 py-3"><p class="label-caps">Administrators</p></div>
          <div class="divide-y divide-line">
            <div v-for="admin in org.admins" :key="admin.id" class="px-4 py-3">
              <p class="text-sm">{{ admin.name }}</p>
              <p class="mt-0.5 text-[11px] text-muted">{{ admin.email }}</p>
            </div>
            <p v-if="org.admins.length === 0" class="p-4 text-xs text-muted">
              No administrators invited.
            </p>
          </div>
        </aside>
      </div>
    </template>

    <AppModal v-model="labOpen" title="Add laboratory" :persistent="saving"
      ><div class="grid gap-3 sm:grid-cols-2">
        <FormField label="Laboratory name" for-id="new-lab-name" required
          ><input id="new-lab-name" v-model="labForm.name" class="input" /></FormField
        ><FormField label="Code" for-id="new-lab-code" required
          ><input
            id="new-lab-code"
            v-model="labForm.code"
            class="input font-mono uppercase" /></FormField
        ><FormField label="Accession prefix" for-id="new-lab-prefix"
          ><input
            id="new-lab-prefix"
            v-model="labForm.accessionPrefix"
            class="input font-mono uppercase"
            maxlength="8" /></FormField
        ><FormField label="Currency" for-id="new-lab-currency"
          ><input
            id="new-lab-currency"
            v-model="labForm.currency"
            class="input font-mono uppercase"
            maxlength="3" /></FormField
        ><FormField label="Phone" for-id="new-lab-phone"
          ><input id="new-lab-phone" v-model="labForm.phone" class="input" /></FormField
        ><FormField label="Email" for-id="new-lab-email"
          ><input id="new-lab-email" v-model="labForm.email" class="input"
        /></FormField>
      </div>
      <div class="mt-3">
        <p class="field-label">Disciplines</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <label
            v-for="discipline in DISCIPLINES"
            :key="discipline"
            class="flex items-center gap-2 border border-line px-3 py-2 text-xs"
            ><input
              v-model="selectedDisciplines"
              type="checkbox"
              :value="discipline"
              class="h-4 w-4 accent-[rgb(var(--accent))]"
            />{{ DISCIPLINE_LABELS[discipline] }}</label
          >
        </div>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="labOpen = false">Cancel</button
        ><button
          type="button"
          class="btn btn-primary"
          :disabled="saving || !labForm.name || !labForm.code"
          @click="addLab"
        >
          Provision laboratory
        </button></template
      ></AppModal
    >
    <AppModal v-model="adminOpen" title="Invite administrator" :persistent="saving"
      ><div v-if="inviteUrl" class="space-y-3">
        <p class="text-sm text-success">Invitation created. Share this one-time link:</p>
        <code class="block break-all border border-line bg-canvas p-3 text-xs">{{
          inviteUrl
        }}</code>
      </div>
      <div v-else class="grid gap-3">
        <FormField label="Full name" for-id="invite-name" required
          ><input id="invite-name" v-model="adminForm.name" class="input" /></FormField
        ><FormField label="Work email" for-id="invite-email" required
          ><input id="invite-email" v-model="adminForm.email" type="email" class="input"
        /></FormField>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="adminOpen = false">
          {{ inviteUrl ? 'Close' : 'Cancel' }}</button
        ><button
          v-if="!inviteUrl"
          type="button"
          class="btn btn-primary"
          :disabled="saving || !adminForm.name || !adminForm.email"
          @click="invite"
        >
          Send invitation
        </button></template
      ></AppModal
    >
  </div>
</template>
