<script setup lang="ts">
import { portalRequestSchema } from '@lims/shared';
import type { PortalRequestResult, AuthResponse } from '@lims/shared';

definePageMeta({ layout: 'auth', title: 'Referral sign-in' });
useHead({ title: 'Referral sign-in' });

const api = useApi();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const loading = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);
const fieldErrors = reactive<Record<string, string>>({});
const debugCode = ref<string | null>(null);
const form = reactive({ labCode: 'HISTO', email: '', code: '' });

function clearErrors(): void {
  error.value = null;
  for (const key of Object.keys(fieldErrors)) delete fieldErrors[key];
}

async function requestLink(): Promise<void> {
  clearErrors();
  const parsed = portalRequestSchema.safeParse({ labCode: form.labCode, email: form.email });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join('.')] = issue.message;
    return;
  }
  loading.value = true;
  try {
    const result = await api.post<PortalRequestResult>('/portal/auth/request', parsed.data);
    sent.value = true;
    debugCode.value = result.debugCode ?? null;
    if (result.debugCode) form.code = result.debugCode;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

async function verify(): Promise<boolean> {
  clearErrors();
  if (!/^\d{6}$/.test(form.code.trim())) {
    fieldErrors.code = 'Enter the six-digit code from your email or SMS.';
    return false;
  }
  loading.value = true;
  try {
    const session = await api.post<AuthResponse>('/portal/auth/verify', {
      labCode: form.labCode,
      email: form.email,
      code: form.code.trim(),
      token: typeof route.query.token === 'string' ? route.query.token : undefined,
    });
    auth.setSession(session);
    await router.push('/referrer');
    return true;
  } catch (caught) {
    error.value = apiErrorMessage(caught);
    return false;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  const lab = typeof route.query.lab === 'string' ? route.query.lab : '';
  const email = typeof route.query.email === 'string' ? route.query.email : '';
  const token = typeof route.query.token === 'string' ? route.query.token : '';
  if (lab) form.labCode = lab.toUpperCase();
  if (email) form.email = email;
  if (token && lab && email) {
    loading.value = true;
    try {
      const session = await api.post<AuthResponse>('/portal/auth/verify', {
        labCode: lab,
        email,
        token,
      });
      auth.setSession(session);
      await router.replace('/referrer');
    } catch (caught) {
      error.value = apiErrorMessage(caught);
      sent.value = true;
    } finally {
      loading.value = false;
    }
  }
});
</script>

<template>
  <div>
    <div class="mb-7">
      <p class="label-caps mb-3 flex items-center gap-2">
        <span class="inline-block h-1.5 w-1.5 bg-accent" />
        Referral portal · one-time access
      </p>
      <h1 class="display text-4xl leading-[1.02] tracking-tight">Follow the<br />specimen.</h1>
      <p class="mt-4 max-w-sm text-sm leading-relaxed text-muted">
        Sign in with the email on your referral. We send a single-use link and a six-digit code — no
        password to remember.
      </p>
    </div>

    <div
      v-if="error"
      class="mb-5 border border-danger/40 bg-danger/[0.05] p-3.5 text-xs leading-relaxed text-danger"
      role="alert"
    >
      {{ error }}
    </div>

    <div v-if="sent" class="space-y-4">
      <div class="border border-success/30 bg-success/[0.05] p-4">
        <p class="font-mono text-2xs uppercase tracking-caps text-success">Check your inbox</p>
        <p class="mt-1.5 text-xs leading-relaxed text-ink">
          If <strong>{{ form.email }}</strong> belongs to a referral account, a sign-in link and
          code are on their way. The link expires in 15 minutes.
        </p>
        <p
          v-if="debugCode"
          class="mt-3 border border-warning/40 bg-warning/10 p-2 font-mono text-xs text-ink"
        >
          Local demo code: <strong>{{ debugCode }}</strong>
        </p>
      </div>

      <FormField label="Six-digit code" for-id="portal-code" required :error="fieldErrors.code">
        <input
          id="portal-code"
          v-model="form.code"
          class="input text-center font-mono text-xl tracking-[0.4em]"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          placeholder="000000"
          @input="fieldErrors.code = ''"
        />
      </FormField>
      <button type="button" class="btn btn-primary w-full py-3" :disabled="loading" @click="verify">
        <AppIcon v-if="loading" name="refresh" :size="14" class="animate-spin" />
        <AppIcon v-else name="arrow-right" :size="14" />
        {{ loading ? 'Checking…' : 'Open my referrals' }}
      </button>
      <button type="button" class="btn btn-ghost w-full" :disabled="loading" @click="requestLink">
        Send a new code
      </button>
    </div>

    <form v-else class="space-y-4" novalidate @submit.prevent="requestLink">
      <FormField label="Laboratory code" for-id="portal-lab" required :error="fieldErrors.labCode">
        <input
          id="portal-lab"
          v-model="form.labCode"
          class="input font-mono uppercase tracking-widest"
          placeholder="HISTO"
        />
      </FormField>
      <FormField
        label="Email on your referral"
        for-id="portal-email"
        required
        :error="fieldErrors.email"
      >
        <input
          id="portal-email"
          v-model="form.email"
          type="email"
          class="input"
          autocomplete="email"
          placeholder="you@clinic.ng"
        />
      </FormField>
      <button type="submit" class="btn btn-primary w-full py-3" :disabled="loading">
        <AppIcon v-if="!loading" name="send" :size="14" />
        <AppIcon v-else name="refresh" :size="14" class="animate-spin" />
        {{ loading ? 'Sending…' : 'Email me a sign-in code' }}
      </button>
    </form>

    <div
      class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[11px] text-muted"
    >
      <NuxtLink to="/login" class="font-mono text-[9px] uppercase tracking-caps hover:text-ink">
        Laboratory staff sign-in
      </NuxtLink>
      <NuxtLink to="/verify" class="font-mono text-[9px] uppercase tracking-caps hover:text-ink">
        Verify a report
      </NuxtLink>
    </div>
  </div>
</template>
