<script setup lang="ts">
definePageMeta({ layout: 'auth', title: 'Referral portal' });
useHead({ title: 'Referral portal' });

const auth = useAuthStore();
const router = useRouter();

async function signOut(): Promise<void> {
  await auth.logout();
  await router.push('/login');
}

onMounted(() => {
  if (auth.role !== 'REFERRER') void router.push(auth.homePath);
});
</script>

<template>
  <div>
    <p class="label-caps mb-3 flex items-center gap-2">
      <span class="h-1.5 w-1.5 bg-accent" />
      Referring clinician
    </p>
    <h1 class="display text-4xl leading-tight">Referral portal.</h1>
    <p class="mt-3 text-sm leading-relaxed text-muted">
      Hello{{ auth.displayName ? `, ${auth.displayName}` : '' }}. Your account is active at
      {{ auth.lab?.name }}.
    </p>

    <div class="mt-6 border border-line bg-surface">
      <div class="border-b border-line bg-canvas/60 px-4 py-3">
        <p class="font-mono text-[9px] uppercase tracking-caps text-accent">Phase 2</p>
        <p class="mt-1 text-sm font-medium">Status tracking &amp; notifications</p>
      </div>
      <div class="space-y-3 p-4 text-xs leading-relaxed text-muted">
        <p>
          The referrer portal — magic-link or OTP sign-in, case status, SMS/WhatsApp/email
          notifications and report release — is designed for Phase 2 and is not enabled in this
          deployment.
        </p>
        <p>
          For now, the laboratory will contact you using the details on the referral. You can verify
          a printed report with its QR code.
        </p>
      </div>
      <div class="flex flex-col gap-2 border-t border-line p-4">
        <NuxtLink to="/verify" class="btn btn-secondary justify-start">
          <AppIcon name="qr" :size="13" /> Report verification
        </NuxtLink>
        <button type="button" class="btn btn-ghost justify-start" @click="signOut">
          <AppIcon name="logout" :size="13" /> Sign out
        </button>
      </div>
    </div>
  </div>
</template>
