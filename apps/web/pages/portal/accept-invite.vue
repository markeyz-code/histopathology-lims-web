<script setup lang="ts">
import type { AuthResponse } from '@lims/shared';

definePageMeta({ layout: 'auth', title: 'Accept invitation' });
useHead({ title: 'Accept laboratory administrator invitation' });

const route = useRoute();
const api = useApi();
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const password = ref('');
const confirm = ref('');
const saving = ref(false);
const error = ref<string | null>(null);
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''));

async function submit(): Promise<void> {
  if (password.value.length < 8) {
    error.value = 'Use at least 8 characters.';
    return;
  }
  if (password.value !== confirm.value) {
    error.value = 'Passwords do not match.';
    return;
  }
  if (!token.value) {
    error.value = 'This invitation link is incomplete.';
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    const payload = await api.post<AuthResponse>('/auth/accept-invite', {
      token: token.value,
      password: password.value,
    });
    auth.setSession(payload);
    toast.success('Welcome to your laboratory', 'Your administrator account is ready.');
    await router.push('/admin/settings');
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="w-full max-w-md">
    <div class="panel p-6 sm:p-8">
      <p class="label-caps">Laboratory administrator</p>
      <h1 class="display mt-2 text-3xl">Set up your laboratory</h1>
      <p class="mt-2 text-sm text-muted">
        Your invitation is single-use and expires after seven days. Choose a password to enter the
        admin console.
      </p>
      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <FormField label="New password" for-id="invite-password" required
          ><input
            id="invite-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="input"
        /></FormField>
        <FormField label="Confirm password" for-id="invite-confirm" required
          ><input
            id="invite-confirm"
            v-model="confirm"
            type="password"
            autocomplete="new-password"
            class="input"
        /></FormField>
        <p v-if="error" class="border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          {{ error }}
        </p>
        <button type="submit" class="btn btn-primary w-full" :disabled="saving || !token">
          {{ saving ? 'Setting up…' : 'Create administrator account' }}
        </button>
      </form>
      <p v-if="!token" class="mt-4 text-xs text-danger">
        This link is invalid or incomplete. Ask your platform administrator for a new invitation.
      </p>
    </div>
  </div>
</template>
