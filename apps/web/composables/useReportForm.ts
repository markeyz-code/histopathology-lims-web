import type {
  Protocol,
  ProtocolContent,
  ReportData,
  ReportCoding,
  ReportDetail,
  ReportIssue,
  ReportValue,
} from '@lims/shared';
import { generateNarrative, reportCompleteness, validateReportData } from '@lims/shared';

interface UseReportFormOptions {
  subspecialty?: string | null;
}

export function useReportForm(caseId: string, options: UseReportFormOptions = {}) {
  const api = useApi();
  const toast = useToast();

  const report = ref<ReportDetail | null>(null);
  const protocols = ref<Protocol[]>([]);
  const protocolId = ref('');
  const data = reactive<ReportData>({});
  const coding = ref<ReportCoding>(emptyCoding());
  const issues = ref<ReportIssue[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const dirty = ref(false);
  const error = ref<string | null>(null);
  let hydrating = false;

  watch(
    data,
    () => {
      if (!hydrating) dirty.value = true;
    },
    { deep: true, flush: 'sync' },
  );
  watch(
    coding,
    () => {
      if (!hydrating) dirty.value = true;
    },
    { deep: true, flush: 'sync' },
  );

  const selectedProtocol = computed<Protocol | null>(() =>
    report.value
      ? null
      : (protocols.value.find((protocol) => protocol.id === protocolId.value) ?? null),
  );

  const content = computed<ProtocolContent | null>(
    () => report.value?.protocol?.content ?? selectedProtocol.value?.content ?? null,
  );

  const narrative = computed(() => (content.value ? generateNarrative(content.value, data) : ''));

  const completeness = computed(() =>
    content.value ? reportCompleteness(content.value, data) : null,
  );

  const missing = computed(() => completeness.value?.missingRequired ?? []);
  const isEditable = computed(() => !report.value || report.value.status === 'DRAFT');
  const isSignedOut = computed(() => report.value?.status === 'SIGNED_OUT');
  const isAmended = computed(() => report.value?.status === 'AMENDED');

  function applyData(values: ReportData): void {
    hydrating = true;
    for (const key of Object.keys(data)) delete data[key];
    for (const [key, value] of Object.entries(values)) data[key] = value;
    hydrating = false;
    dirty.value = false;
  }

  function applyCoding(value: ReportCoding | null | undefined): void {
    hydrating = true;
    coding.value = value ? { ...value } : emptyCoding();
    hydrating = false;
    dirty.value = false;
  }

  function fieldError(key: string): string | null {
    return issues.value.find((issue) => issue.fieldKey === key)?.message ?? null;
  }

  function validate(): boolean {
    if (!content.value) return false;
    const result = validateReportData(content.value, data);
    issues.value = result.errors;
    return result.errors.length === 0;
  }

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const existing = await api.get<ReportDetail | null>(`/reports/case/${caseId}`);
      // The API returns an empty body when no report exists yet; treat that as null.
      report.value = existing && typeof existing === 'object' ? existing : null;
      if (report.value) {
        applyData(report.value.data);
        applyCoding(report.value.coding);
      } else {
        applyCoding(null);
        const query: Record<string, string | boolean> = { active: true };
        if (options.subspecialty) query.subspecialty = options.subspecialty;
        protocols.value = await api.get<Protocol[]>('/protocols', query);
        if (protocols.value.length === 0) {
          protocols.value = await api.get<Protocol[]>('/protocols', { active: true });
        }
        if (protocols.value.length > 0 && !protocolId.value) {
          protocolId.value = protocols.value[0]?.id ?? '';
        }
        applyData({});
      }
    } catch (caught) {
      error.value = apiErrorMessage(caught);
    } finally {
      loading.value = false;
    }
  }

  async function startReport(): Promise<boolean> {
    if (!protocolId.value) {
      toast.error('Choose a protocol', 'A synoptic protocol is required to start a report.');
      return false;
    }
    saving.value = true;
    try {
      report.value = await api.post<ReportDetail>(`/reports/case/${caseId}`, {
        protocolId: protocolId.value,
      });
      applyData(report.value.data);
      applyCoding(report.value.coding);
      toast.success('Draft created', 'The synoptic report is ready to complete.');
      return true;
    } catch (caught) {
      toast.error('Could not start the report', apiErrorMessage(caught));
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function save(): Promise<boolean> {
    if (!report.value) return startReport();
    if (!validate()) {
      toast.error(
        'Check the highlighted fields',
        issues.value[0]?.message ?? 'Some values are not valid.',
      );
      return false;
    }
    saving.value = true;
    try {
      report.value = await api.patch<ReportDetail>(`/reports/${report.value.id}`, {
        data,
        coding: coding.value,
      });
      applyData(report.value.data);
      applyCoding(report.value.coding);
      toast.success('Draft saved', 'Structured data and narrative are up to date.');
      return true;
    } catch (caught) {
      toast.error('Could not save the draft', apiErrorMessage(caught));
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function signOut(): Promise<boolean> {
    if (!report.value) return false;
    if (dirty.value) {
      const saved = await save();
      if (!saved) return false;
    }
    if (missing.value.length > 0) {
      toast.error(
        'Required fields are incomplete',
        missing.value.slice(0, 4).join(', ') + (missing.value.length > 4 ? '…' : ''),
      );
      return false;
    }
    saving.value = true;
    try {
      report.value = await api.post<ReportDetail>(`/reports/${report.value.id}/sign-out`);
      applyData(report.value.data);
      applyCoding(report.value.coding);
      toast.success(
        'Report signed out',
        'The report is locked. Any change now requires an amendment.',
      );
      return true;
    } catch (caught) {
      toast.error('Sign-out blocked', apiErrorMessage(caught));
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function amend(reason: string): Promise<boolean> {
    if (!report.value) return false;
    if (!validate()) {
      toast.error('Check the highlighted fields', 'Invalid values must be corrected first.');
      return false;
    }
    saving.value = true;
    try {
      report.value = await api.post<ReportDetail>(`/reports/${report.value.id}/amend`, {
        reason,
        data,
        coding: coding.value,
      });
      applyData(report.value.data);
      applyCoding(report.value.coding);
      toast.success('Amendment signed', 'A new immutable report version has been created.');
      return true;
    } catch (caught) {
      toast.error('Amendment failed', apiErrorMessage(caught));
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function previewPdf(): Promise<Blob | null> {
    if (!report.value) return null;
    try {
      return await api.blob(`/reports/${report.value.id}/pdf`);
    } catch (caught) {
      toast.error('PDF unavailable', apiErrorMessage(caught));
      return null;
    }
  }

  function setField(key: string, value: ReportValue): void {
    data[key] = value;
  }

  return {
    report,
    protocols,
    protocolId,
    data,
    coding,
    issues,
    loading,
    saving,
    dirty,
    error,
    selectedProtocol,
    content,
    narrative,
    completeness,
    missing,
    isEditable,
    isSignedOut,
    isAmended,
    load,
    startReport,
    save,
    signOut,
    amend,
    previewPdf,
    validate,
    fieldError,
    setField,
  };
}

function emptyCoding(): ReportCoding {
  return {
    snomedCode: null,
    snomedDisplay: null,
    icdo3MorphologyCode: null,
    icdo3MorphologyDisplay: null,
    icdo3TopographyCode: null,
    icdo3TopographyDisplay: null,
  };
}
