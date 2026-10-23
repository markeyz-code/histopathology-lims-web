<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{ error: NuxtError }>();
const pageTitle = computed(() =>
  props.error.statusCode === 404 ? 'Page not found' : 'Something went wrong',
);
useHead({ title: pageTitle });

// The Nuxt error app mounts outside the page route; keep the document title exact.
onMounted(async () => {
  await nextTick();
  // Nuxt's global head can reapply the default title after the error view mounts.
  setTimeout(() => {
    document.title = `${pageTitle.value} · Laboratory LIMS`;
  }, 50);
});
const auth = useAuthStore();
function reload(): void {
  location.reload();
}

function goHome(): void {
  clearError({ redirect: auth.isAuthenticated ? '/' : '/login' });
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-canvas">
    <header class="flex items-center justify-between border-b border-line px-5 py-4 sm:px-8">
      <AppWordmark />
      <ThemeToggle />
    </header>
    <main class="flex flex-1 items-center justify-center px-5 py-12">
      <div class="w-full max-w-xl">
        <p class="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          Error {{ error.statusCode ?? 500 }}
        </p>
        <h1 class="display mt-3 text-5xl leading-none tracking-tight">
          {{
            error.statusCode === 404
              ? 'That page is not in the register.'
              : 'Something interrupted the record.'
          }}
        </h1>
        <p class="mt-4 text-sm leading-relaxed text-muted">
          {{
            error.statusCode === 404
              ? 'The address may be mistyped or the page may have moved. The case register is the safest place to start.'
              : error.message ||
                'An unexpected error occurred. Try again, or contact the laboratory administrator with the time and page.'
          }}
        </p>
        <div class="mt-7 flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary" @click="goHome">
            {{ auth.isAuthenticated ? 'Back to dashboard' : 'Sign in' }}
          </button>
          <NuxtLink to="/cases" class="btn btn-secondary">Case register</NuxtLink>
          <button type="button" class="btn btn-ghost" @click="reload">Reload</button>
        </div>
      </div>
    </main>
    <footer
      class="border-t border-line px-5 py-4 font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:px-8"
    >
      Laboratory LIMS · Phase 1.5
    </footer>
  </div>
</template>
