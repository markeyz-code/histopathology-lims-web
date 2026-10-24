<script setup lang="ts">
const modelOpen = defineModel<boolean>({ default: false });
const propOpen = defineModel<boolean>('open', { default: false });
const open = computed({
  get: () => modelOpen.value || propOpen.value,
  set: (value: boolean) => {
    modelOpen.value = value;
    propOpen.value = value;
  },
});

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    persistent?: boolean;
    eyebrow?: string;
  }>(),
  { size: 'md', persistent: false },
);

const emit = defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);
const titleId = useId();
let previousFocus: HTMLElement | null = null;

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'max-w-md';
    case 'lg':
      return 'max-w-3xl';
    case 'xl':
      return 'max-w-5xl';
    default:
      return 'max-w-xl';
  }
});

function close(): void {
  if (props.persistent) return;
  open.value = false;
  emit('close');
}

function focusFirst(): void {
  const target = panel.value?.querySelector<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  target?.focus();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.stopPropagation();
    close();
    return;
  }
  if (event.key !== 'Tab' || !panel.value) return;
  const focusable = Array.from(
    panel.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(open, async (value) => {
  if (!import.meta.client) return;
  if (value) {
    previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    await nextTick();
    focusFirst();
  } else {
    document.body.style.overflow = '';
    previousFocus?.focus();
    previousFocus = null;
  }
});

onBeforeUnmount(() => {
  if (import.meta.client) document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="overlay fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6"
        @click.self="close"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          class="modal-panel max-h-[92vh] overflow-y-auto scroll-area animate-scan-in"
          :class="sizeClass"
          @keydown="onKeydown"
        >
          <header
            class="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6"
          >
            <div class="min-w-0">
              <p v-if="eyebrow" class="label-caps mb-1">{{ eyebrow }}</p>
              <h2 :id="titleId" class="display text-xl leading-tight sm:text-2xl">
                {{ title }}
              </h2>
              <p v-if="description" class="mt-1.5 max-w-xl text-xs leading-relaxed text-muted">
                {{ description }}
              </p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm -mr-2 shrink-0"
              aria-label="Close dialog"
              @click="close"
            >
              <AppIcon name="close" :size="16" />
            </button>
          </header>
          <div class="px-5 py-5 sm:px-6">
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas/50 px-5 py-4 sm:px-6"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
