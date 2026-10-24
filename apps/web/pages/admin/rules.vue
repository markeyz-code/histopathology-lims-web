<script setup lang="ts">
import type { Discipline, LabRule, RuleTrigger } from '@lims/shared';
import { DISCIPLINES, DISCIPLINE_LABELS, RULE_ACTIONS, RULE_TRIGGERS } from '@lims/shared';

definePageMeta({ title: 'Rules', capabilities: ['admin'] });
useHead({ title: 'Rules engine' });

const api = useApi();
const toast = useToast();
const rules = ref<LabRule[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const modalOpen = ref(false);
const editing = ref<LabRule | null>(null);
const formError = ref<string | null>(null);
const discipline = ref<Discipline>('HAEMATOLOGY');
const trigger = ref<RuleTrigger>('RESULT_SAVE');
const disciplineOptions = DISCIPLINES.map((value) => ({ value, label: DISCIPLINE_LABELS[value] }));
const triggerOptions = RULE_TRIGGERS.map((value) => ({ value, label: value.replace('_', ' ') }));
const form = reactive({
  code: '',
  name: '',
  description: '',
  testCodes: '',
  priority: 100,
  active: true,
  conditions: JSON.stringify(
    { field: 'values.hb.flag', op: 'in', value: ['LOW', 'CRITICAL_LOW'] },
    null,
    2,
  ),
  actions: JSON.stringify(
    [
      {
        type: 'REFLEX_TEST',
        testCode: 'RETIC',
        message: 'Low haemoglobin — add reticulocyte count.',
      },
    ],
    null,
    2,
  ),
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    rules.value = await api.get<LabRule[]>('/rules');
  } catch (caught) {
    error.value = apiErrorMessage(caught);
  } finally {
    loading.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  form.code = '';
  form.name = '';
  form.description = '';
  form.testCodes = '';
  form.priority = 100;
  form.active = true;
  form.conditions = JSON.stringify({ field: 'values.hb.flag', op: 'in', value: ['LOW'] }, null, 2);
  form.actions = JSON.stringify(
    [{ type: 'REFLEX_TEST', testCode: 'RETIC', message: 'Reflex test.' }],
    null,
    2,
  );
  formError.value = null;
  modalOpen.value = true;
}

function openEdit(rule: LabRule): void {
  editing.value = rule;
  discipline.value = rule.discipline;
  trigger.value = rule.trigger;
  form.code = rule.code;
  form.name = rule.name;
  form.description = rule.description ?? '';
  form.testCodes = rule.testCodes.join(', ');
  form.priority = rule.priority;
  form.active = rule.active;
  form.conditions = JSON.stringify(rule.conditions, null, 2);
  form.actions = JSON.stringify(rule.actions, null, 2);
  formError.value = null;
  modalOpen.value = true;
}

async function save(): Promise<void> {
  formError.value = null;
  let conditions: unknown;
  let actions: unknown;
  try {
    conditions = JSON.parse(form.conditions);
    actions = JSON.parse(form.actions);
  } catch {
    formError.value = 'Conditions and actions must be valid JSON.';
    return;
  }
  saving.value = true;
  try {
    const payload = {
      code: form.code,
      name: form.name,
      description: form.description || null,
      discipline: discipline.value,
      trigger: trigger.value,
      testCodes: form.testCodes
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
      priority: form.priority,
      active: form.active,
      conditions,
      actions,
    };
    if (editing.value) await api.patch(`/rules/${editing.value.id}`, payload);
    else await api.post('/rules', payload);
    toast.success(editing.value ? 'Rule updated' : 'Rule created', form.code.toUpperCase());
    modalOpen.value = false;
    await load();
  } catch (caught) {
    formError.value = apiErrorMessage(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Administration"
      title="Rules engine"
      description="JSON-defined autoverification, reflex, delta-check and critical-value rules. No eval — every action is audited with the rule that fired."
    >
      <template #actions>
        <button type="button" class="btn btn-secondary" :disabled="loading" @click="load">
          <AppIcon name="refresh" :size="13" /> Refresh
        </button>
        <button type="button" class="btn btn-primary" @click="openCreate">
          <AppIcon name="plus" :size="13" /> New rule
        </button>
      </template>
      <template #meta
        ><span>{{ rules.length }} rules</span
        ><span>{{ RULE_ACTIONS.length }} action types</span></template
      >
    </PageHeader>
    <AdminNav />
    <ErrorState v-if="error" :message="error" @retry="load" />
    <LoadingSkeleton v-else-if="loading" :rows="8" />
    <section v-else class="panel overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Discipline</th>
            <th>Trigger</th>
            <th>Tests</th>
            <th>Priority</th>
            <th>Status</th>
            <th class="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rule in rules" :key="rule.id">
            <td>
              <p class="mono text-[10px] text-accent">{{ rule.code }}</p>
              <p class="mt-0.5 text-sm font-medium">{{ rule.name }}</p>
              <p class="mt-0.5 text-[10px] text-muted">
                {{ rule.actions.map((action) => action.type).join(' · ') }}
              </p>
            </td>
            <td class="text-xs text-muted">{{ DISCIPLINE_LABELS[rule.discipline] }}</td>
            <td class="font-mono text-[10px]">{{ rule.trigger }}</td>
            <td class="text-xs">
              {{ rule.testCodes.length ? rule.testCodes.join(', ') : 'All tests' }}
            </td>
            <td class="mono text-xs">{{ rule.priority }}</td>
            <td>
              <span
                class="font-mono text-[9px] uppercase tracking-wide2"
                :class="rule.active ? 'text-success' : 'text-muted'"
                >{{ rule.active ? 'Active' : 'Inactive' }}</span
              >
            </td>
            <td class="text-right">
              <button type="button" class="btn btn-ghost btn-sm" @click="openEdit(rule)">
                Edit
              </button>
            </td>
          </tr>
          <tr v-if="rules.length === 0">
            <td colspan="7" class="py-8 text-center text-xs text-muted">No rules configured.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <AppModal v-model="modalOpen" :title="editing ? 'Edit rule' : 'New rule'" :persistent="saving">
      <div class="space-y-4">
        <div
          v-if="formError"
          class="border border-danger/40 bg-danger/[0.05] p-3 text-xs text-danger"
          role="alert"
        >
          {{ formError }}
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <FormField label="Code" for-id="rule-code" required
            ><input id="rule-code" v-model="form.code" class="input font-mono uppercase"
          /></FormField>
          <FormField label="Name" for-id="rule-name" required
            ><input id="rule-name" v-model="form.name" class="input"
          /></FormField>
          <FormField label="Discipline" for-id="rule-discipline"
            ><SearchSelect id="rule-discipline" v-model="discipline" :options="disciplineOptions"
          /></FormField>
          <FormField label="Trigger" for-id="rule-trigger"
            ><SearchSelect id="rule-trigger" v-model="trigger" :options="triggerOptions"
          /></FormField>
          <FormField label="Test codes" for-id="rule-tests"
            ><input
              id="rule-tests"
              v-model="form.testCodes"
              class="input font-mono uppercase"
              placeholder="FBC, EUC (blank = all)"
          /></FormField>
          <FormField label="Priority" for-id="rule-priority"
            ><input
              id="rule-priority"
              v-model.number="form.priority"
              type="number"
              min="0"
              class="input"
          /></FormField>
          <div class="sm:col-span-2">
            <FormField label="Description" for-id="rule-description">
              <textarea
                id="rule-description"
                v-model="form.description"
                class="textarea min-h-[60px]"
              />
            </FormField>
          </div>
          <div class="sm:col-span-2">
            <FormField label="Active" for-id="rule-active"
              ><label class="flex items-center gap-2 text-xs"
                ><input
                  id="rule-active"
                  v-model="form.active"
                  type="checkbox"
                  class="h-4 w-4 accent-[rgb(var(--accent))]"
                />
                Evaluate this rule</label
              ></FormField
            >
          </div>
        </div>
        <FormField
          label="Conditions JSON"
          for-id="rule-conditions"
          required
          hint="Nested all/any/not with field + op + value. Operators: eq, ne, gt, gte, lt, lte, in, between, contains, exists."
        >
          <textarea
            id="rule-conditions"
            v-model="form.conditions"
            class="textarea min-h-[140px] font-mono text-[11px]"
            spellcheck="false"
          />
        </FormField>
        <FormField
          label="Actions JSON"
          for-id="rule-actions"
          required
          hint="AUTO_VERIFY, CRITICAL_ALERT, REFLEX_TEST, DELTA_CHECK, CASCADE_ANTIBIOTIC, REQUIRE_REVIEW."
        >
          <textarea
            id="rule-actions"
            v-model="form.actions"
            class="textarea min-h-[120px] font-mono text-[11px]"
            spellcheck="false"
          />
        </FormField>
      </div>
      <template #footer>
        <button type="button" class="btn btn-ghost" :disabled="saving" @click="modalOpen = false">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : 'Save rule' }}
        </button>
      </template>
    </AppModal>
  </div>
</template>
