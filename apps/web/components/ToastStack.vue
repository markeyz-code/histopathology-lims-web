<script setup lang="ts">
const { toasts, dismiss } = useToast();
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-end gap-2 p-4 sm:p-6"
      aria-live="polite"
      aria-atomic="false"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-precise"
        enter-from-class="translate-y-2 opacity-0"
        leave-active-class="transition duration-150 ease-precise"
        leave-to-class="translate-x-3 opacity-0"
      >
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 border bg-surface p-4 shadow-lift"
          :class="{
            'border-success/40': toast.kind === 'success',
            'border-danger/40': toast.kind === 'error',
            'border-accent/40': toast.kind === 'info',
          }"
          role="status"
        >
          <div
            class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border"
            :class="{
              'border-success/30 bg-success/10 text-success': toast.kind === 'success',
              'border-danger/30 bg-danger/10 text-danger': toast.kind === 'error',
              'border-accent/30 bg-accent/10 text-accent': toast.kind === 'info',
            }"
          >
            <AppIcon
              :name="
                toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'alert' : 'clock'
              "
              :size="15"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-mono text-2xs uppercase tracking-caps text-ink">{{ toast.title }}</p>
            <p v-if="toast.message" class="mt-1 text-xs leading-relaxed text-muted">
              {{ toast.message }}
            </p>
          </div>
          <button
            type="button"
            class="text-muted transition-colors hover:text-ink"
            aria-label="Dismiss notification"
            @click="dismiss(toast.id)"
          >
            <AppIcon name="close" :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
