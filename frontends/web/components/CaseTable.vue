<script setup lang="ts">
import type { CaseListItem } from '@lims/shared';

withDefaults(defineProps<{ cases: CaseListItem[]; showPathologist?: boolean }>(), {
  showPathologist: true,
});

const { date, name } = useFormat();
const auth = useAuthStore();
</script>

<template>
  <div>
    <div class="hidden overflow-x-auto md:block">
      <table class="data-table">
        <thead>
          <tr>
            <th scope="col">Case / patient</th>
            <th scope="col">Priority</th>
            <th scope="col">Status</th>
            <th scope="col">Material</th>
            <th scope="col">Turnaround</th>
            <th v-if="showPathologist" scope="col" class="hidden xl:table-cell">Pathologist</th>
            <th scope="col" class="hidden xl:table-cell">Received</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in cases" :key="item.id">
            <td class="min-w-[250px]">
              <NuxtLink :to="`/cases/${item.id}`" class="group block">
                <span class="mono text-[12px] font-medium text-accent group-hover:underline">
                  {{ item.accessionNumber }}
                </span>
                <span class="mt-0.5 block truncate text-sm font-medium text-ink">
                  {{ name(item.patient.firstName, item.patient.lastName) }}
                </span>
                <span class="mono text-2xs text-muted">
                  {{ item.patient.mrn }} · {{ item.patient.sex }} · {{ item.patient.age ?? '—' }}
                </span>
              </NuxtLink>
            </td>
            <td>
              <StatusChip :status="item.priority" kind="priority" size="sm" />
            </td>
            <td>
              <StatusChip :status="item.status" kind="case" size="sm" />
            </td>
            <td class="whitespace-nowrap text-xs text-muted">
              <span class="mono text-ink">{{ item.summary.specimenCount }}</span> spec ·
              <span class="mono text-ink">{{ item.summary.blockCount }}</span> blocks ·
              <span class="mono text-ink">{{ item.summary.slideCount }}</span> slides
              <span v-if="item.report" class="mt-1 block text-2xs">
                Report: {{ item.report.status.replace('_', ' ') }}
              </span>
            </td>
            <td>
              <TatCountdown
                :started-at="item.receivedAt"
                :deadline="item.tatDeadline"
                :warning-percent="auth.lab?.tatWarningPercent ?? 80"
                :done="item.status === 'REPORTED' || item.status === 'AMENDED'"
                compact
              />
            </td>
            <td
              v-if="showPathologist"
              class="hidden whitespace-nowrap text-xs text-muted xl:table-cell"
            >
              <span v-if="item.assignedPathologist" class="text-ink">
                {{ item.assignedPathologist.name }}
              </span>
              <span v-else class="font-mono text-2xs uppercase tracking-wide2 text-warning"
                >Unassigned</span
              >
            </td>
            <td class="hidden whitespace-nowrap font-mono text-[11px] text-muted xl:table-cell">
              {{ date(item.receivedAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="divide-y divide-line border-y border-line md:hidden">
      <NuxtLink
        v-for="item in cases"
        :key="item.id"
        :to="`/cases/${item.id}`"
        class="block px-4 py-4 transition-colors hover:bg-ink/[0.025]"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="mono text-[11px] text-accent">{{ item.accessionNumber }}</p>
            <p class="mt-1 truncate text-sm font-medium">
              {{ name(item.patient.firstName, item.patient.lastName) }}
            </p>
            <p class="mono text-2xs text-muted">
              {{ item.patient.mrn }} · {{ item.patient.age ?? '—' }} yrs
            </p>
          </div>
          <StatusChip :status="item.priority" kind="priority" size="sm" />
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <StatusChip :status="item.status" kind="case" size="sm" />
          <TatCountdown
            :started-at="item.receivedAt"
            :deadline="item.tatDeadline"
            :warning-percent="auth.lab?.tatWarningPercent ?? 80"
            :done="item.status === 'REPORTED' || item.status === 'AMENDED'"
            compact
          />
        </div>
        <div class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-muted">
          <span>{{ item.summary.blockCount }} blocks · {{ item.summary.slideCount }} slides</span>
          <span v-if="item.assignedPathologist">{{ item.assignedPathologist.name }}</span>
          <span v-else class="text-warning">Unassigned</span>
          <span>{{ date(item.receivedAt) }}</span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
