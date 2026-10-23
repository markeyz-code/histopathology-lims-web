<script setup lang="ts">
definePageMeta({ layout: 'auth', title: 'Verify report' });
useHead({ title: 'Verify report' });

const router = useRouter();
const code = ref('');

function submit(): void {
  const value = code.value.trim().toUpperCase();
  if (value) void router.push(`/verify/${encodeURIComponent(value)}`);
}
</script>

<template>
  <div>
    <p class="label-caps mb-3 flex items-center gap-2">
      <span class="h-1.5 w-1.5 bg-accent" />
      Report verification
    </p>
    <h1 class="display text-4xl leading-tight">Verify a report.</h1>
    <p class="mt-3 text-sm leading-relaxed text-muted">
      Enter the verification code printed below the QR code on a signed histopathology report.
    </p>
    <form class="mt-6 flex gap-2" @submit.prevent="submit">
      <input
        v-model="code"
        class="input mono flex-1 uppercase"
        placeholder="Verification code"
        aria-label="Verification code"
        autocomplete="off"
      />
      <button type="submit" class="btn btn-primary" :disabled="!code.trim()">
        <AppIcon name="qr" :size="13" /> Verify
      </button>
    </form>
    <NuxtLink
      to="/login"
      class="mt-6 inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-caps text-muted hover:text-accent"
    >
      <AppIcon name="arrow-left" :size="11" /> Laboratory sign-in
    </NuxtLink>
  </div>
</template>
