<script setup lang="ts">
const auth = useAuthStore();
const router = useRouter();

async function signOut(): Promise<void> {
  await auth.logout();
  await router.push('/portal/login');
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-canvas">
    <header class="border-b border-rail-line bg-rail text-rail-ink">
      <div class="mx-auto flex max-w-shell flex-wrap items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <AppWordmark variant="rail" compact />
        <span class="hidden h-8 w-px bg-rail-line sm:block" />
        <div class="min-w-0">
          <p class="font-mono text-[8px] uppercase tracking-[0.18em] text-rail-muted">
            {{ auth.lab?.code ?? 'Referral portal' }}
          </p>
          <p class="line-clamp-1 text-xs text-rail-ink">
            {{ auth.lab?.name ?? 'Histopathology laboratory' }}
          </p>
        </div>

        <nav class="ml-auto flex items-center gap-2">
          <template v-if="auth.isAuthenticated">
            <NuxtLink
              to="/referrer"
              class="hidden border border-rail-line px-3 py-1.5 font-mono text-[9px] uppercase tracking-caps text-rail-muted transition-colors hover:text-rail-ink sm:block"
            >
              My referrals
            </NuxtLink>
            <NuxtLink
              to="/verify"
              class="hidden border border-rail-line px-3 py-1.5 font-mono text-[9px] uppercase tracking-caps text-rail-muted transition-colors hover:text-rail-ink md:block"
            >
              Verify a report
            </NuxtLink>
            <button
              type="button"
              class="border border-rail-line px-3 py-1.5 font-mono text-[9px] uppercase tracking-caps text-rail-muted transition-colors hover:text-rail-ink"
              @click="signOut"
            >
              Sign out
            </button>
          </template>
          <span
            v-else
            class="border border-rail-line px-3 py-1.5 font-mono text-[9px] uppercase tracking-caps text-rail-muted"
          >
            Secure payment
          </span>
          <ThemeToggle variant="rail" />
        </nav>
      </div>
    </header>

    <main
      id="main-content"
      class="mx-auto w-full max-w-shell flex-1 px-4 py-7 sm:px-6 lg:px-8 lg:py-10"
    >
      <slot />
    </main>

    <footer class="border-t border-line px-4 py-4 sm:px-6 lg:px-8">
      <div
        class="mx-auto flex max-w-shell flex-col justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:flex-row"
      >
        <span>Laboratory LIMS · Referral portal</span>
        <span>{{ auth.lab?.name ?? 'Clinical system' }} · access monitored and audited</span>
      </div>
    </footer>
  </div>
</template>
