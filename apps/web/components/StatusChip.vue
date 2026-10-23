<script setup lang="ts">
import {
  CASE_STATUSES,
  CASE_STATUS_LABELS,
  PHYSICAL_STATES,
  PHYSICAL_STATE_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  REPORT_STATUS_LABELS,
  type CaseStatus,
  type PhysicalState,
  type Priority,
  type ReportStatus,
} from '@lims/shared';

const props = withDefaults(
  defineProps<{
    status: string;
    kind?: 'auto' | 'case' | 'stage' | 'report' | 'priority';
    size?: 'sm' | 'md';
  }>(),
  { kind: 'auto', size: 'md' },
);

const priorityStyles: Record<Priority, string> = {
  FROZEN: 'border-accent bg-accent text-accent-ink',
  URGENT:
    'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100',
  ROUTINE: 'border-line-strong bg-transparent text-muted',
};

const caseStyles: Record<CaseStatus, string> = {
  RECEIVED:
    'border-stone-300 bg-stone-100 text-stone-800 dark:border-stone-600 dark:bg-stone-800/70 dark:text-stone-100',
  IN_PROGRESS:
    'border-sky-300 bg-sky-100 text-sky-950 dark:border-sky-700 dark:bg-sky-950/70 dark:text-sky-100',
  PENDING_REVIEW:
    'border-violet-300 bg-violet-100 text-violet-950 dark:border-violet-700 dark:bg-violet-950/70 dark:text-violet-100',
  REPORTED:
    'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-100',
  AMENDED:
    'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100',
};

const stageStyles: Record<PhysicalState, string> = {
  ACCESSIONED:
    'border-stone-300 bg-stone-100 text-stone-800 dark:border-stone-600 dark:bg-stone-800/70 dark:text-stone-100',
  GROSSED:
    'border-orange-300 bg-orange-100 text-orange-950 dark:border-orange-700 dark:bg-orange-950/70 dark:text-orange-100',
  PROCESSING:
    'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100',
  EMBEDDED:
    'border-lime-300 bg-lime-100 text-lime-950 dark:border-lime-700 dark:bg-lime-950/70 dark:text-lime-100',
  CUT: 'border-teal-300 bg-teal-100 text-teal-950 dark:border-teal-700 dark:bg-teal-950/70 dark:text-teal-100',
  STAINED:
    'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-950 dark:border-fuchsia-700 dark:bg-fuchsia-950/70 dark:text-fuchsia-100',
  WITH_PATHOLOGIST:
    'border-indigo-300 bg-indigo-100 text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-100',
  REPORTED:
    'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-100',
  ARCHIVED:
    'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-100',
  RECUT_REQUESTED:
    'border-rose-300 bg-rose-100 text-rose-950 dark:border-rose-700 dark:bg-rose-950/70 dark:text-rose-100',
  REJECTED:
    'border-red-300 bg-red-100 text-red-950 dark:border-red-700 dark:bg-red-950/70 dark:text-red-100',
};

const reportStyles: Record<ReportStatus, string> = {
  DRAFT: 'border-line-strong bg-transparent text-muted dark:border-stone-600 dark:text-stone-300',
  SIGNED_OUT:
    'border-emerald-300 bg-emerald-100 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-100',
  AMENDED:
    'border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100',
};

const effectiveKind = computed(() => {
  if (props.kind !== 'auto') return props.kind;
  if ((PRIORITIES as readonly string[]).includes(props.status)) return 'priority';
  if (props.status === 'DRAFT' || props.status === 'SIGNED_OUT') return 'report';
  if ((CASE_STATUSES as readonly string[]).includes(props.status)) return 'case';
  if ((PHYSICAL_STATES as readonly string[]).includes(props.status)) return 'stage';
  return 'case';
});

const label = computed(() => {
  if (effectiveKind.value === 'priority') {
    return PRIORITY_LABELS[props.status as Priority] ?? props.status;
  }
  if (effectiveKind.value === 'report') {
    return REPORT_STATUS_LABELS[props.status as ReportStatus] ?? props.status;
  }
  if (effectiveKind.value === 'stage') {
    return PHYSICAL_STATE_LABELS[props.status as PhysicalState] ?? props.status;
  }
  return CASE_STATUS_LABELS[props.status as CaseStatus] ?? props.status;
});

const styleClass = computed(() => {
  if (effectiveKind.value === 'priority') {
    return priorityStyles[props.status as Priority] ?? priorityStyles.ROUTINE;
  }
  if (effectiveKind.value === 'report') {
    return reportStyles[props.status as ReportStatus] ?? reportStyles.DRAFT;
  }
  if (effectiveKind.value === 'stage') {
    return stageStyles[props.status as PhysicalState] ?? stageStyles.ACCESSIONED;
  }
  return caseStyles[props.status as CaseStatus] ?? caseStyles.RECEIVED;
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 whitespace-nowrap border font-mono uppercase tracking-wide2"
    :class="[styleClass, size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-2xs']"
    :data-status="status"
  >
    <span class="h-1.5 w-1.5 shrink-0 bg-current opacity-60" aria-hidden="true" />
    {{ label }}
  </span>
</template>
