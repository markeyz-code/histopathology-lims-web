import {
  CASE_STATUS_LABELS,
  PHYSICAL_STATE_LABELS,
  PRIORITY_LABELS,
  REPORT_STATUS_LABELS,
  SEX_LABELS,
  type CaseStatus,
  type PhysicalState,
  type Priority,
  type ReportStatus,
  type Sex,
} from '@lims/shared';

export function useFormat() {
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  function date(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : dateFormatter.format(parsed);
  }

  function dateTime(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? '—' : dateTimeFormatter.format(parsed);
  }

  function time(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(parsed);
  }

  function relative(value: string | Date | null | undefined): string {
    if (!value) return '—';
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    const diffSeconds = Math.round((parsed.getTime() - Date.now()) / 1000);
    const absolute = Math.abs(diffSeconds);
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (absolute < 60) return formatter.format(diffSeconds, 'second');
    if (absolute < 3_600) return formatter.format(Math.round(diffSeconds / 60), 'minute');
    if (absolute < 86_400) return formatter.format(Math.round(diffSeconds / 3_600), 'hour');
    if (absolute < 2_592_000) return formatter.format(Math.round(diffSeconds / 86_400), 'day');
    if (absolute < 31_536_000) {
      return formatter.format(Math.round(diffSeconds / 2_592_000), 'month');
    }
    return formatter.format(Math.round(diffSeconds / 31_536_000), 'year');
  }

  function initials(first?: string | null, last?: string | null): string {
    return `${(first ?? '').charAt(0)}${(last ?? '').charAt(0)}`.toUpperCase() || '—';
  }

  function name(first?: string | null, last?: string | null): string {
    return `${first ?? ''} ${last ?? ''}`.trim() || 'Unknown patient';
  }

  function caseStatus(status: CaseStatus | string): string {
    return CASE_STATUS_LABELS[status as CaseStatus] ?? status;
  }

  function stageStatus(status: PhysicalState | string): string {
    return PHYSICAL_STATE_LABELS[status as PhysicalState] ?? status;
  }

  function reportStatus(status: ReportStatus | string | null | undefined): string {
    if (!status) return 'No report';
    return REPORT_STATUS_LABELS[status as ReportStatus] ?? status;
  }

  function priority(value: Priority | string): string {
    return PRIORITY_LABELS[value as Priority] ?? value;
  }

  function sex(value: Sex | string): string {
    return SEX_LABELS[value as Sex] ?? value;
  }

  function titleCase(value: string): string {
    return value.toLowerCase().replace(/(^|\s|[-/])\S/g, (character) => character.toUpperCase());
  }

  function number(value: number | null | undefined, fractionDigits = 0): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat('en-GB', {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(value);
  }

  function plural(count: number, singular: string, pluralForm?: string): string {
    return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
  }

  return {
    date,
    dateTime,
    time,
    relative,
    initials,
    name,
    caseStatus,
    stageStatus,
    reportStatus,
    priority,
    sex,
    titleCase,
    number,
    plural,
  };
}
