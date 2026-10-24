<script setup lang="ts" generic="T extends string | number | null | undefined">
import type { IconName } from '~/types/icons';

export interface SearchSelectOption<Value = string | number | null> {
  value: Value;
  label: string;
  description?: string;
  keywords?: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    modelValue: T;
    options: SearchSelectOption<T>[];
    id?: string;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    disabled?: boolean;
    ariaLabel?: string;
    icon?: IconName;
    fullWidth?: boolean;
  }>(),
  {
    id: undefined,
    placeholder: 'Select…',
    searchPlaceholder: 'Search…',
    emptyText: 'No matches',
    disabled: false,
    ariaLabel: undefined,
    icon: undefined,
    fullWidth: true,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: T];
  change: [value: T];
}>();

const open = ref(false);
const query = ref('');
const activeIndex = ref(0);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelRef = ref<HTMLDivElement | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
const dropUp = ref(false);
const listId = `search-select-${Math.random().toString(36).slice(2)}`;

const selected = computed(() =>
  props.options.find((option) => Object.is(option.value, props.modelValue ?? null)),
);

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return props.options;
  return props.options.filter((option) => {
    const haystack = [option.label, option.description, option.keywords]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });
});

function position(): void {
  const trigger = triggerRef.value;
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const margin = 8;
  const width = Math.min(Math.max(rect.width, 230), window.innerWidth - margin * 2);
  const left = Math.min(Math.max(rect.left, margin), window.innerWidth - width - margin);
  const below = window.innerHeight - rect.bottom;
  const above = rect.top;
  const estimated = Math.min(320, filtered.value.length * 54 + 74);
  const shouldDropUp = below < estimated && above > below;
  dropUp.value = shouldDropUp;
  panelStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    width: `${width}px`,
    zIndex: '120',
    ...(shouldDropUp
      ? { bottom: `${window.innerHeight - rect.top + 4}px` }
      : { top: `${rect.bottom + 4}px` }),
  };
}

function openPanel(): void {
  if (props.disabled || open.value) return;
  open.value = true;
  query.value = '';
  const index = props.options.findIndex((option) =>
    Object.is(option.value, props.modelValue ?? null),
  );
  activeIndex.value = Math.max(0, index);
  nextTick(() => {
    position();
    searchRef.value?.focus();
    scrollActiveIntoView();
  });
}

function closePanel(): void {
  open.value = false;
  query.value = '';
}

function toggle(): void {
  if (open.value) closePanel();
  else openPanel();
}

function choose(option: SearchSelectOption<T>): void {
  if (option.disabled) return;
  emit('update:modelValue', option.value);
  emit('change', option.value);
  closePanel();
  triggerRef.value?.focus();
}

function move(delta: number): void {
  if (filtered.value.length === 0) return;
  let next = activeIndex.value;
  for (let i = 0; i < filtered.value.length; i += 1) {
    next = (next + delta + filtered.value.length) % filtered.value.length;
    if (!filtered.value[next]?.disabled) break;
  }
  activeIndex.value = next;
  nextTick(scrollActiveIntoView);
}

function scrollActiveIntoView(): void {
  const panel = panelRef.value;
  const active = panel?.querySelector<HTMLElement>('[data-active="true"]');
  active?.scrollIntoView({ block: 'nearest' });
}

function onTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    openPanel();
  }
}

function onSearchKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    move(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    move(-1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const option = filtered.value[activeIndex.value];
    if (option) choose(option);
  } else if (event.key === 'Escape' || event.key === 'Tab') {
    closePanel();
    triggerRef.value?.focus();
  }
}

function onPointerDown(event: PointerEvent): void {
  const target = event.target as Node | null;
  if (!target) return;
  if (triggerRef.value?.contains(target) || panelRef.value?.contains(target)) return;
  closePanel();
}

function onReposition(): void {
  if (open.value) position();
}

watch(query, (value) => {
  if (open.value && value.trim()) {
    activeIndex.value = 0;
    nextTick(position);
  }
});

watch(
  () => props.modelValue,
  () => {
    if (!open.value) query.value = '';
  },
);

watch(open, (value) => {
  if (value) {
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
  } else {
    document.removeEventListener('pointerdown', onPointerDown, true);
    window.removeEventListener('resize', onReposition);
    window.removeEventListener('scroll', onReposition, true);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown, true);
  window.removeEventListener('resize', onReposition);
  window.removeEventListener('scroll', onReposition, true);
});
</script>

<template>
  <button
    :id="id"
    ref="triggerRef"
    type="button"
    class="input flex items-center gap-2 pr-9 text-left"
    :class="{ 'w-full': fullWidth, 'cursor-not-allowed opacity-60': disabled }"
    :disabled="disabled"
    :aria-label="ariaLabel"
    role="combobox"
    :aria-expanded="open"
    :aria-controls="listId"
    aria-haspopup="listbox"
    @click="toggle"
    @keydown="onTriggerKeydown"
  >
    <AppIcon v-if="icon" :name="icon" :size="13" class="shrink-0 text-muted" />
    <span class="min-w-0 flex-1 truncate" :class="selected ? 'text-ink' : 'text-muted'">
      {{ selected?.label ?? placeholder }}
    </span>
    <AppIcon
      name="chevron-down"
      :size="13"
      class="shrink-0 text-muted transition-transform"
      :class="{ 'rotate-180': open }"
    />
  </button>

  <Teleport to="body">
    <div
      v-if="open"
      ref="panelRef"
      class="fixed border border-line-strong bg-surface shadow-2xl"
      :style="panelStyle"
    >
      <div class="border-b border-line bg-raised p-2">
        <div class="relative">
          <AppIcon
            name="search"
            :size="13"
            class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref="searchRef"
            v-model="query"
            type="text"
            class="input input-sm w-full pl-8"
            :placeholder="searchPlaceholder"
            autocomplete="off"
            spellcheck="false"
            role="combobox"
            :aria-controls="listId"
            :aria-expanded="open"
            aria-autocomplete="list"
            @keydown="onSearchKeydown"
          />
        </div>
      </div>
      <ul :id="listId" class="scroll-area max-h-[264px] overflow-y-auto py-1" role="listbox">
        <li
          v-for="(option, index) in filtered"
          :key="`${String(option.value)}-${option.label}`"
          :data-active="index === activeIndex"
          class="cursor-pointer px-3 py-2.5 text-xs transition-colors"
          :class="[
            index === activeIndex ? 'bg-accent/[0.08] text-ink' : 'text-muted hover:bg-raised',
            option.disabled ? 'cursor-not-allowed opacity-40' : '',
          ]"
          role="option"
          :aria-selected="Object.is(option.value, modelValue ?? null)"
          @mouseenter="activeIndex = index"
          @mousedown.prevent="choose(option)"
        >
          <div class="flex items-start gap-2">
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ option.label }}</span>
              <span v-if="option.description" class="mt-0.5 block truncate text-[10px] text-muted">
                {{ option.description }}
              </span>
            </span>
            <AppIcon
              v-if="Object.is(option.value, modelValue ?? null)"
              name="check"
              :size="12"
              class="mt-0.5 shrink-0 text-accent"
            />
          </div>
        </li>
        <li v-if="filtered.length === 0" class="px-3 py-5 text-center text-xs text-muted">
          {{ emptyText }}
        </li>
      </ul>
      <p
        class="border-t border-line px-3 py-1.5 font-mono text-[8px] uppercase tracking-wide2 text-muted"
      >
        Type to search · ↑↓ to move · Enter to select
      </p>
    </div>
  </Teleport>
</template>
