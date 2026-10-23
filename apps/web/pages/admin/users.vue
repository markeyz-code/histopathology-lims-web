<script setup lang="ts">
import type { Paginated, Role, User } from '@lims/shared';
import { ROLES, ROLE_LABELS, createUserSchema, resetPasswordSchema } from '@lims/shared';

definePageMeta({ title: 'Staff', capabilities: ['admin'] });
useHead({ title: 'Staff accounts' });

const api = useApi();
const auth = useAuthStore();
const toast = useToast();
const { relative } = useFormat();

const users = ref<User[]>([]);
const total = ref(0);
const page = ref(1);
const totalPages = ref(1);
const loading = ref(true);
const error = ref<string | null>(null);
const roleFilter = ref<Role | ''>('');
const query = ref('');

const createOpen = ref(false);
const createSaving = ref(false);
const createError = ref<string | null>(null);
const createForm = reactive({
  name: '',
  email: '',
  role: 'TECHNOLOGIST' as Role,
  password: '',
  subspecialties: '',
});

const resetOpen = ref(false);
const resetTarget = ref<User | null>(null);
const resetPassword = ref('');
const resetSaving = ref(false);
const resetError = ref<string | null>(null);
const toggleSaving = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const params: Record<string, string | number | boolean> = { page: page.value, limit: 20 };
    if (roleFilter.value) params.role = roleFilter.value;
    if (query.value.trim()) params.q = query.value.trim();
    const result = await api.get<Paginated<User>>('/users', params);
    users.value = result.items;
    total.value = result.total;
    totalPages.value = result.totalPages;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

const debouncedSearch = useDebounceFn(() => {
  page.value = 1;
  void load();
}, 250);

watch(query, () => debouncedSearch());
watch(roleFilter, () => {
  page.value = 1;
  void load();
});
watch(page, () => load());

function openCreate(): void {
  createError.value = null;
  createForm.name = '';
  createForm.email = '';
  createForm.role = 'TECHNOLOGIST';
  createForm.password = '';
  createForm.subspecialties = '';
  createOpen.value = true;
}

async function submitCreate(): Promise<void> {
  createError.value = null;
  const parsed = createUserSchema.safeParse({
    name: createForm.name,
    email: createForm.email,
    role: createForm.role,
    password: createForm.password,
    subspecialties: createForm.subspecialties
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  });
  if (!parsed.success) {
    createError.value = parsed.error.issues.map((issue) => issue.message).join(' ');
    return;
  }
  createSaving.value = true;
  try {
    await api.post<User>('/users', parsed.data);
    toast.success('Account created', `${parsed.data.email} · ${ROLE_LABELS[parsed.data.role]}`);
    createOpen.value = false;
    await load();
  } catch (caught) {
    createError.value = apiErrorMessage(caught);
  } finally {
    createSaving.value = false;
  }
}

async function toggleActive(user: User): Promise<void> {
  if (user.id === auth.user?.id) return;
  toggleSaving.value = user.id;
  try {
    await api.patch<User>(`/users/${user.id}`, { active: !user.active });
    toast.success(user.active ? 'Account deactivated' : 'Account reactivated', user.name);
    await load();
  } catch (caught) {
    toast.error('Could not update account', apiErrorMessage(caught));
  } finally {
    toggleSaving.value = null;
  }
}

function openReset(user: User): void {
  resetTarget.value = user;
  resetPassword.value = '';
  resetError.value = null;
  resetOpen.value = true;
}

async function submitReset(): Promise<void> {
  if (!resetTarget.value) return;
  resetError.value = null;
  const parsed = resetPasswordSchema.safeParse({ password: resetPassword.value });
  if (!parsed.success) {
    resetError.value = parsed.error.issues.map((issue) => issue.message).join(' ');
    return;
  }
  resetSaving.value = true;
  try {
    await api.post(`/users/${resetTarget.value.id}/reset-password`, parsed.data);
    toast.success('Password reset', `${resetTarget.value.email} must sign in again.`);
    resetOpen.value = false;
    await load();
  } catch (caught) {
    resetError.value = apiErrorMessage(caught);
  } finally {
    resetSaving.value = false;
  }
}

onMounted(() => load());
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="Staff accounts"
      description="Roles determine what every person can see and do. Accounts are lab-scoped and never shared."
    >
      <template #actions>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <AppIcon name="plus" :size="13" /> New staff account
        </button>
      </template>
      <template #meta>
        <span class="mono">{{ total }} accounts</span>
        <span>Passwords are hashed with bcrypt</span>
      </template>
    </PageHeader>

    <AdminNav />

    <div class="mb-4 flex flex-wrap gap-2">
      <div class="relative min-w-[220px] flex-1">
        <AppIcon
          name="search"
          :size="14"
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          v-model="query"
          type="search"
          class="input pl-9"
          placeholder="Search name or email"
          aria-label="Search staff"
        />
      </div>
      <select v-model="roleFilter" class="select w-auto" aria-label="Filter by role">
        <option value="">All roles</option>
        <option v-for="role in ROLES" :key="role" :value="role">{{ ROLE_LABELS[role] }}</option>
      </select>
    </div>

    <ErrorState v-if="error" :message="error" @retry="load" />

    <div v-else class="panel">
      <LoadingSkeleton v-if="loading" kind="table" :rows="5" />
      <EmptyState
        v-else-if="users.length === 0"
        icon="users"
        title="No accounts match"
        message="Adjust the search or create a new staff account."
        :bordered="false"
      >
        <button type="button" class="btn btn-primary" @click="openCreate">New staff account</button>
      </EmptyState>
      <div v-else class="overflow-x-auto">
        <table class="data-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Role</th>
              <th scope="col">Subspecialties</th>
              <th scope="col">Status</th>
              <th scope="col">Last sign-in</th>
              <th scope="col" class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>
                <p class="text-sm font-medium">{{ user.name }}</p>
                <p class="mono text-[10px] text-muted">{{ user.email }}</p>
              </td>
              <td>
                <span
                  class="inline-flex border border-line bg-canvas px-2 py-1 font-mono text-[9px] uppercase tracking-wide2 text-muted"
                >
                  {{ ROLE_LABELS[user.role] }}
                </span>
              </td>
              <td class="max-w-[220px] text-xs text-muted">
                {{ user.subspecialties.length > 0 ? user.subspecialties.join(', ') : '—' }}
              </td>
              <td>
                <span
                  class="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wide2"
                  :class="user.active ? 'text-success' : 'text-danger'"
                >
                  <span class="h-1.5 w-1.5 bg-current" />
                  {{ user.active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td
                class="whitespace-nowrap font-mono text-[10px] text-muted"
                :title="user.lastLoginAt ?? undefined"
              >
                {{ user.lastLoginAt ? relative(user.lastLoginAt) : 'Never' }}
              </td>
              <td>
                <div class="flex justify-end gap-1">
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    :disabled="resetSaving"
                    @click="openReset(user)"
                  >
                    Reset password
                  </button>
                  <span
                    v-if="user.id === auth.user?.id"
                    class="px-2 py-1.5 font-mono text-[9px] uppercase tracking-wide2 text-muted"
                  >
                    Current account
                  </span>
                  <button
                    v-else
                    type="button"
                    class="btn btn-ghost btn-sm"
                    :class="user.active ? 'text-danger' : 'text-success'"
                    :disabled="toggleSaving === user.id"
                    @click="toggleActive(user)"
                  >
                    {{ user.active ? 'Deactivate' : 'Reactivate' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="users.length > 0"
        class="flex items-center justify-between border-t border-line px-4 py-3"
      >
        <p class="font-mono text-[10px] uppercase tracking-wide2 text-muted">
          Page {{ page }} of {{ totalPages }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="page <= 1"
            @click="page -= 1"
          >
            Previous
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            :disabled="page >= totalPages"
            @click="page += 1"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <AppModal
      v-model="createOpen"
      title="Create staff account"
      description="The user signs in with the laboratory code and this temporary password."
      :persistent="createSaving"
    >
      <div
        v-if="createError"
        class="mb-4 border border-danger/40 bg-danger/[0.05] p-3 text-xs text-danger"
        role="alert"
      >
        {{ createError }}
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <FormField label="Full name" for-id="new-name" required>
            <input
              id="new-name"
              v-model="createForm.name"
              class="input"
              placeholder="Dr Chioma Nwosu"
            />
          </FormField>
        </div>
        <FormField label="Email" for-id="new-email" required>
          <input
            id="new-email"
            v-model="createForm.email"
            type="email"
            class="input"
            placeholder="name@histo.ng"
          />
        </FormField>
        <FormField label="Role" for-id="new-role" required>
          <select id="new-role" v-model="createForm.role" class="select">
            <option v-for="role in ROLES" :key="role" :value="role">{{ ROLE_LABELS[role] }}</option>
          </select>
        </FormField>
        <FormField
          label="Temporary password"
          for-id="new-password"
          required
          hint="At least 8 characters with a letter and a number."
        >
          <input
            id="new-password"
            v-model="createForm.password"
            type="text"
            class="input font-mono"
            autocomplete="new-password"
          />
        </FormField>
        <FormField
          label="Subspecialties"
          for-id="new-subs"
          optional
          hint="Comma-separated, e.g. Breast, Gastrointestinal."
        >
          <input
            id="new-subs"
            v-model="createForm.subspecialties"
            class="input"
            placeholder="Breast, Gastrointestinal"
          />
        </FormField>
      </div>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="createSaving"
          @click="createOpen = false"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="createSaving"
          @click="submitCreate"
        >
          <AppIcon name="plus" :size="13" /> Create account
        </button>
      </template>
    </AppModal>

    <AppModal
      v-model="resetOpen"
      title="Reset password"
      :description="resetTarget?.email"
      :persistent="resetSaving"
    >
      <div
        v-if="resetError"
        class="mb-4 border border-danger/40 bg-danger/[0.05] p-3 text-xs text-danger"
        role="alert"
      >
        {{ resetError }}
      </div>
      <FormField
        label="New password"
        for-id="reset-password"
        required
        hint="The user’s refresh token is revoked immediately."
      >
        <input
          id="reset-password"
          v-model="resetPassword"
          type="text"
          class="input font-mono"
          autocomplete="new-password"
        />
      </FormField>
      <template #footer>
        <button
          type="button"
          class="btn btn-ghost"
          :disabled="resetSaving"
          @click="resetOpen = false"
        >
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="resetSaving" @click="submitReset">
          Reset password
        </button>
      </template>
    </AppModal>
  </div>
</template>
