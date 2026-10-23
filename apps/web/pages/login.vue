<script setup lang="ts">
import { loginSchema } from '@lims/shared';

definePageMeta({ layout: 'auth', title: 'Sign in' });
useHead({ title: 'Sign in' });

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const form = reactive({
  labCode: 'HISTO',
  email: '',
  password: '',
});
const errors = reactive<Record<string, string>>({});
const formError = ref<string | null>(null);
const loading = ref(false);
const showPassword = ref(false);

const config = useRuntimeConfig();
const isLocalDemo = computed(() => {
  try {
    return ['localhost', '127.0.0.1'].includes(new URL(String(config.public.apiBase)).hostname);
  } catch {
    return false;
  }
});

const demoAccounts = [
  { role: 'Pathologist', email: 'pathologist@histo.ng', password: 'Pathologist#2026' },
  { role: 'Technologist', email: 'technologist@histo.ng', password: 'Technologist#2026' },
  { role: 'Reception', email: 'reception@histo.ng', password: 'Reception#2026' },
  { role: 'Lab admin', email: 'admin@histo.ng', password: 'LabAdmin#2026' },
];

function clearErrors(): void {
  formError.value = null;
  for (const key of Object.keys(errors)) delete errors[key];
}

function useDemo(account: (typeof demoAccounts)[number]): void {
  form.email = account.email;
  form.password = account.password;
  form.labCode = 'HISTO';
  clearErrors();
}

async function submit(): Promise<void> {
  clearErrors();
  const parsed = loginSchema.safeParse(form);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      if (!errors[key]) errors[key] = issue.message;
    }
    return;
  }
  loading.value = true;
  try {
    const result = await auth.login(parsed.data);
    toast.success(
      `Welcome, ${result.user.name}`,
      `${result.lab.name} · ${result.user.role.replace('_', ' ').toLowerCase()}`,
    );
    const redirect = route.query.redirect;
    const destination =
      typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('/login')
        ? redirect
        : auth.homePath;
    await router.push(destination);
  } catch (error) {
    formError.value = apiErrorMessage(error);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="mb-8">
      <p class="label-caps mb-3 flex items-center gap-2">
        <span class="inline-block h-1.5 w-1.5 bg-accent" aria-hidden="true" />
        Secure laboratory access
      </p>
      <h1 class="display text-4xl leading-[1.02] tracking-tight sm:text-[2.9rem]">
        Sign in to the<br />laboratory.
      </h1>
      <p class="mt-4 max-w-sm text-sm leading-relaxed text-muted">
        Use the credentials issued by your laboratory administrator. Every action is tied to your
        name and recorded in the audit log.
      </p>
    </div>

    <div v-if="formError" class="mb-5 border border-danger/40 bg-danger/[0.05] p-3.5" role="alert">
      <div class="flex items-start gap-2.5">
        <AppIcon name="alert" :size="16" class="mt-0.5 shrink-0 text-danger" />
        <div>
          <p class="font-mono text-2xs uppercase tracking-caps text-danger">Sign-in failed</p>
          <p class="mt-1 text-xs leading-relaxed text-ink">{{ formError }}</p>
        </div>
      </div>
    </div>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <FormField label="Laboratory code" for-id="lab-code" required :error="errors.labCode">
        <input
          id="lab-code"
          v-model="form.labCode"
          class="input font-mono uppercase tracking-widest"
          autocomplete="organization"
          placeholder="HISTO"
          @input="errors.labCode = ''"
        />
      </FormField>

      <FormField label="Email address" for-id="email" required :error="errors.email">
        <input
          id="email"
          v-model="form.email"
          type="email"
          class="input"
          autocomplete="username"
          inputmode="email"
          placeholder="you@laboratory.ng"
          @input="errors.email = ''"
        />
      </FormField>

      <FormField label="Password" for-id="password" required :error="errors.password">
        <div class="relative">
          <input
            id="password"
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            class="input pr-11"
            autocomplete="current-password"
            placeholder="Your password"
            @input="errors.password = ''"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted transition-colors hover:text-ink"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <AppIcon name="eye" :size="15" />
          </button>
        </div>
      </FormField>

      <button type="submit" class="btn btn-primary w-full py-3" :disabled="loading">
        <AppIcon v-if="!loading" name="arrow-right" :size="14" />
        <AppIcon v-else name="refresh" :size="14" class="animate-spin" />
        {{ loading ? 'Signing in…' : 'Enter the laboratory' }}
      </button>
    </form>

    <p class="mt-4 text-center text-[11px] leading-relaxed text-muted">
      No public sign-up. Accounts are issued and revoked by the laboratory administrator.
    </p>

    <NuxtLink
      to="/portal/login"
      class="mt-3 flex items-center justify-center gap-2 border border-line bg-surface px-3 py-2.5 font-mono text-[9px] uppercase tracking-caps text-muted transition-colors hover:border-accent hover:text-ink"
    >
      <AppIcon name="stethoscope" :size="13" />
      Referring clinician? Use a one-time link
    </NuxtLink>

    <details v-if="isLocalDemo" class="mt-7 border border-line bg-surface">
      <summary
        class="cursor-pointer px-4 py-3 font-mono text-2xs uppercase tracking-caps text-muted marker:text-accent"
      >
        Seeded demonstration accounts
      </summary>
      <div class="border-t border-line">
        <button
          v-for="account in demoAccounts"
          :key="account.email"
          type="button"
          class="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-left last:border-b-0 hover:bg-ink/[0.03]"
          @click="useDemo(account)"
        >
          <span>
            <span class="block text-xs font-medium text-ink">{{ account.role }}</span>
            <span class="mono block text-[10px] text-muted">{{ account.email }}</span>
          </span>
          <span class="font-mono text-[9px] uppercase tracking-caps text-accent">Use</span>
        </button>
      </div>
    </details>

    <div
      class="mt-7 flex items-center gap-2 border-t border-line pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted"
    >
      <AppIcon name="shield" :size="13" />
      <span>Encrypted session · Audit recorded · Lab-scoped</span>
    </div>
  </div>
</template>
