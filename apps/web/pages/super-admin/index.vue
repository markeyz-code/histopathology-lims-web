<script setup lang="ts">
import type { Lead, Organization, SuperAdminOverview } from '@lims/shared';
import {
  DISCIPLINES,
  DISCIPLINE_LABELS,
  ORGANIZATION_TYPES,
  SUBSCRIPTION_PLANS,
} from '@lims/shared';

definePageMeta({ title: 'Platform administration', capabilities: ['platform'] });
useHead({ title: 'Platform administration' });

const api = useApi();
const toast = useToast();
const { date } = useFormat();
const overview = ref<SuperAdminOverview | null>(null);
const organizations = ref<Organization[]>([]);
const leads = ref<Lead[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const wizardOpen = ref(false);
const saving = ref(false);
const inviteUrl = ref<string | null>(null);
const selectedDisciplines = ref<string[]>(['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY']);
const form = reactive({
  organization: {
    code: '',
    name: '',
    type: 'HOSPITAL',
    plan: 'TRIAL',
    country: 'Nigeria',
    state: 'Lagos',
    city: '',
    address: '',
    phone: '',
    email: '',
    seats: 15,
  },
  lab: {
    code: '',
    name: '',
    address: '',
    phone: '',
    email: '',
    accessionPrefix: 'HP',
    timezone: 'Africa/Lagos',
    currency: 'NGN',
    qaSamplingPercent: 10,
  },
  administrator: { name: '', email: '', phone: '' },
});
const typeOptions = ORGANIZATION_TYPES.map((value) => ({
  value,
  label: value === 'HOSPITAL' ? 'Hospital group' : 'Standalone laboratory',
}));
const planOptions = SUBSCRIPTION_PLANS.map((value) => ({ value, label: value }));

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    [overview.value, organizations.value, leads.value] = await Promise.all([
      api.get<SuperAdminOverview>('/super-admin/overview'),
      api.get<Organization[]>('/super-admin/organizations'),
      api.get<Lead[]>('/super-admin/leads'),
    ]);
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function resetWizard(): void {
  form.organization.code = '';
  form.organization.name = '';
  form.organization.email = '';
  form.lab.code = '';
  form.lab.name = '';
  form.administrator.name = '';
  form.administrator.email = '';
  selectedDisciplines.value = ['HISTOPATHOLOGY', 'HAEMATOLOGY', 'CHEMICAL_PATHOLOGY'];
  inviteUrl.value = null;
}

async function submit(): Promise<void> {
  saving.value = true;
  try {
    const result = await api.post<{ inviteUrl: string; catalogueTests: number }>(
      '/super-admin/onboard',
      {
        organization: form.organization,
        lab: {
          ...form.lab,
          enabledDisciplines: selectedDisciplines.value,
          address: form.lab.address || form.organization.address,
          phone: form.lab.phone || form.organization.phone,
          email: form.lab.email || form.organization.email,
        },
        administrator: form.administrator,
      },
    );
    inviteUrl.value = result.inviteUrl;
    toast.success('Organization onboarded', `${result.catalogueTests} starter tests provisioned.`);
    await load();
  } catch (caught) {
    toast.error('Onboarding failed', apiErrorMessage(caught));
  } finally {
    saving.value = false;
  }
}

async function setLeadStatus(lead: Lead, status: string): Promise<void> {
  try {
    await api.patch(`/super-admin/leads/${lead.id}`, { status });
    await load();
  } catch (caught) {
    toast.error('Could not update lead', apiErrorMessage(caught));
  }
}

async function copyInvite(): Promise<void> {
  if (!inviteUrl.value) return;
  await navigator.clipboard.writeText(inviteUrl.value);
  toast.success('Invitation link copied', 'Share it securely with the laboratory administrator.');
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Platform administration"
      title="Onboard hospitals and laboratories"
      description="Provision organizations, laboratories and their first administrator. Every laboratory gets an isolated tenant with its own admin configuration, catalogue and staff."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" /> Refresh
        </button>
        <button
          type="button"
          class="btn btn-primary"
          @click="
            resetWizard();
            wizardOpen = true;
          "
        >
          <AppIcon name="plus" :size="13" /> Onboard organization
        </button>
      </template>
      <template #meta><span>B2B platform</span><span>Super administrator only</span></template>
    </PageHeader>
    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="8" />
    <template v-else-if="overview">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div class="panel p-4">
          <p class="label-caps">Organizations</p>
          <p class="mt-2 display text-3xl">{{ overview.organizations }}</p>
          <p class="mt-1 text-[10px] text-muted">{{ overview.activeOrganizations }} active</p>
        </div>
        <div class="panel p-4">
          <p class="label-caps">Laboratories</p>
          <p class="mt-2 display text-3xl">{{ overview.labs }}</p>
          <p class="mt-1 text-[10px] text-muted">{{ overview.activeLabs }} active</p>
        </div>
        <div class="panel p-4">
          <p class="label-caps">Users</p>
          <p class="mt-2 display text-3xl">{{ overview.users }}</p>
          <p class="mt-1 text-[10px] text-muted">Across all tenants</p>
        </div>
        <div class="panel p-4">
          <p class="label-caps">Cases</p>
          <p class="mt-2 display text-3xl">{{ overview.cases }}</p>
          <p class="mt-1 text-[10px] text-muted">Platform activity</p>
        </div>
        <div class="panel p-4">
          <p class="label-caps">Trials ending</p>
          <p class="mt-2 display text-3xl">{{ overview.trialsEndingSoon }}</p>
          <p class="mt-1 text-[10px] text-muted">Within 7 days</p>
        </div>
        <div class="panel p-4">
          <p class="label-caps">Standalone</p>
          <p class="mt-2 display text-3xl">
            {{ organizations.filter((org) => org.type === 'STANDALONE').length }}
          </p>
          <p class="mt-1 text-[10px] text-muted">Independent labs</p>
        </div>
      </div>

      <section class="panel mt-5">
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p class="label-caps">Organizations</p>
            <p class="mt-1 text-xs text-muted">
              Hospitals and standalone laboratories on the platform.
            </p>
          </div>
          <span class="font-mono text-[9px] text-muted">{{ organizations.length }} tenants</span>
        </div>
        <div v-if="organizations.length === 0" class="p-6 text-sm text-muted">
          No organizations yet. Onboard the first one.
        </div>
        <div v-else class="divide-y divide-line">
          <NuxtLink
            v-for="org in organizations"
            :key="org.id"
            :to="`/super-admin/organizations/${org.id}`"
            class="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-raised"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium">{{ org.name }}</p>
                <span
                  class="font-mono text-[9px] uppercase tracking-wide2"
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
              <p class="mono mt-0.5 text-[9px] text-muted">
                {{ org.code }} · {{ org.type }} · {{ org.plan }} · {{ org.country
                }}{{ org.state ? ' / ' + org.state : '' }}
              </p>
            </div>
            <div
              class="flex items-center gap-5 font-mono text-[9px] uppercase tracking-wide2 text-muted"
            >
              <span>{{ org.labCount }} labs</span><span>{{ org.userCount }} users</span
              ><span>{{ org.caseCount }} cases</span
              ><span v-if="org.trialEndsAt">trial {{ date(org.trialEndsAt) }}</span
              ><AppIcon name="chevron-right" :size="14" class="text-accent" />
            </div>
          </NuxtLink>
        </div>
      </section>
    </template>

    <section class="panel mt-5">
      <div class="flex items-center justify-between border-b border-line px-5 py-4">
        <div>
          <p class="label-caps">Commercial enquiries</p>
          <p class="mt-1 text-xs text-muted">
            Demo, trial and support requests from the public landing page.
          </p>
        </div>
        <span class="font-mono text-[9px] text-muted"
          >{{ leads.filter((lead) => lead.status === 'NEW').length }} new</span
        >
      </div>
      <div v-if="leads.length === 0" class="p-5 text-sm text-muted">No enquiries yet.</div>
      <div v-else class="divide-y divide-line">
        <article
          v-for="lead in leads"
          :key="lead.id"
          class="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="font-mono text-[9px] uppercase text-accent">{{ lead.type }}</span
              ><span
                class="font-mono text-[9px] uppercase"
                :class="
                  lead.status === 'NEW'
                    ? 'text-warning'
                    : lead.status === 'CLOSED'
                      ? 'text-muted'
                      : 'text-success'
                "
                >{{ lead.status }}</span
              >
            </div>
            <p class="mt-1 text-sm font-medium">{{ lead.organizationName }}</p>
            <p class="text-[11px] text-muted">
              {{ lead.contactName }} · {{ lead.email }}{{ lead.phone ? ' · ' + lead.phone : '' }}
            </p>
            <p v-if="lead.departments.length" class="mt-1 text-[10px] text-muted">
              {{ lead.departments.join(' · ') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="lead.status === 'NEW'"
              type="button"
              class="btn btn-ghost btn-sm"
              @click="setLeadStatus(lead, 'CONTACTED')"
            >
              Mark contacted
            </button>
            <button
              v-if="lead.status === 'CONTACTED'"
              type="button"
              class="btn btn-ghost btn-sm"
              @click="setLeadStatus(lead, 'QUALIFIED')"
            >
              Qualify
            </button>
            <button
              v-if="lead.status !== 'CLOSED'"
              type="button"
              class="btn btn-ghost btn-sm"
              @click="setLeadStatus(lead, 'CLOSED')"
            >
              Close
            </button>
          </div>
        </article>
      </div>
    </section>

    <AppModal
      v-model="wizardOpen"
      title="Onboard organization"
      description="Create the hospital or standalone laboratory, its first laboratory, and the administrator invitation."
      :persistent="saving"
    >
      <div v-if="inviteUrl" class="space-y-4">
        <div class="border border-success/30 bg-success/10 p-4 text-sm text-success">
          Organization and laboratory provisioned. The administrator invitation is ready.
        </div>
        <div>
          <p class="label-caps">One-time invitation link</p>
          <code class="mt-2 block break-all border border-line bg-canvas p-3 text-xs">{{
            inviteUrl
          }}</code
          ><button type="button" class="btn btn-primary mt-3" @click="copyInvite">
            <AppIcon name="clipboard" :size="13" /> Copy invitation link
          </button>
        </div>
      </div>
      <div v-else class="space-y-5">
        <div>
          <p class="label-caps">1 · Organization</p>
          <div class="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Organization name" for-id="org-name" required
              ><input
                id="org-name"
                v-model="form.organization.name"
                class="input"
                placeholder="Lagos Central Health Group" /></FormField
            ><FormField label="Code" for-id="org-code" required
              ><input
                id="org-code"
                v-model="form.organization.code"
                class="input font-mono uppercase"
                placeholder="LAGOS-CENTRAL" /></FormField
            ><FormField label="Type" for-id="org-type"
              ><SearchSelect
                id="org-type"
                v-model="form.organization.type"
                :options="typeOptions" /></FormField
            ><FormField label="Plan" for-id="org-plan"
              ><SearchSelect
                id="org-plan"
                v-model="form.organization.plan"
                :options="planOptions" /></FormField
            ><FormField label="Email" for-id="org-email"
              ><input
                id="org-email"
                v-model="form.organization.email"
                type="email"
                class="input" /></FormField
            ><FormField label="Phone" for-id="org-phone"
              ><input id="org-phone" v-model="form.organization.phone" class="input" /></FormField
            ><FormField label="State" for-id="org-state"
              ><input id="org-state" v-model="form.organization.state" class="input" /></FormField
            ><FormField label="City" for-id="org-city"
              ><input id="org-city" v-model="form.organization.city" class="input" /></FormField
            ><FormField label="Address" for-id="org-address"
              ><input id="org-address" v-model="form.organization.address" class="input"
            /></FormField>
          </div>
        </div>
        <div>
          <p class="label-caps">2 · First laboratory</p>
          <div class="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Laboratory name" for-id="lab-name" required
              ><input id="lab-name" v-model="form.lab.name" class="input" /></FormField
            ><FormField label="Laboratory code" for-id="lab-code" required
              ><input
                id="lab-code"
                v-model="form.lab.code"
                class="input font-mono uppercase"
                placeholder="LCH-MAIN" /></FormField
            ><FormField label="Accession prefix" for-id="lab-prefix"
              ><input
                id="lab-prefix"
                v-model="form.lab.accessionPrefix"
                class="input font-mono uppercase"
                maxlength="8" /></FormField
            ><FormField label="Currency" for-id="lab-currency"
              ><input
                id="lab-currency"
                v-model="form.lab.currency"
                class="input font-mono uppercase"
                maxlength="3"
            /></FormField>
          </div>
          <div class="mt-3">
            <p class="field-label">Enabled disciplines</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <label
                v-for="discipline in DISCIPLINES"
                :key="discipline"
                class="flex cursor-pointer items-center gap-2 border border-line bg-surface px-3 py-2 text-xs"
                ><input
                  v-model="selectedDisciplines"
                  type="checkbox"
                  :value="discipline"
                  class="h-4 w-4 accent-[rgb(var(--accent))]"
                />{{ DISCIPLINE_LABELS[discipline] }}</label
              >
            </div>
          </div>
        </div>
        <div>
          <p class="label-caps">3 · First administrator</p>
          <div class="mt-2 grid gap-3 sm:grid-cols-2">
            <FormField label="Full name" for-id="admin-name" required
              ><input id="admin-name" v-model="form.administrator.name" class="input" /></FormField
            ><FormField label="Work email" for-id="admin-email" required
              ><input
                id="admin-email"
                v-model="form.administrator.email"
                type="email"
                class="input"
            /></FormField>
          </div>
          <p class="mt-2 text-[11px] text-muted">
            They receive a one-time link to set a password and enter the laboratory admin console.
          </p>
        </div>
      </div>
      <template #footer
        ><button type="button" class="btn btn-ghost" @click="wizardOpen = false">
          {{ inviteUrl ? 'Close' : 'Cancel' }}</button
        ><button
          v-if="!inviteUrl"
          type="button"
          class="btn btn-primary"
          :disabled="
            saving ||
            !form.organization.name ||
            !form.organization.code ||
            !form.lab.name ||
            !form.lab.code ||
            !form.administrator.name ||
            !form.administrator.email ||
            selectedDisciplines.length === 0
          "
          @click="submit"
        >
          {{ saving ? 'Provisioning…' : 'Provision organization' }}
        </button></template
      >
    </AppModal>
  </div>
</template>
