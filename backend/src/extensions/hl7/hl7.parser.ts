import type { Priority, Sex } from '@lims/shared';

export interface ParsedHl7Order {
  messageType: string;
  controlId: string;
  patient: {
    firstName: string;
    lastName: string;
    sex: Sex;
    dateOfBirth?: string;
    age?: number;
    phone?: string;
    address?: string;
    mrn?: string;
  };
  referringClinician: {
    name: string;
    facility?: string;
    phone?: string;
  };
  priority: Priority;
  specimenType: string;
  site: string;
  clinicalHistory: string;
  clinicalDiagnosis?: string;
  orderId?: string;
}

export function parseHl7Order(input: string): ParsedHl7Order {
  const raw = stripMllp(input);
  const segments = raw
    .split(/\r\n|\r|\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const msh = segments.find((segment) => segment.startsWith('MSH'));
  if (!msh) throw new Error('HL7 message has no MSH segment.');
  const pid = segments.find((segment) => segment.startsWith('PID'));
  const obr = segments.find((segment) => segment.startsWith('OBR'));
  const spm = segments.find((segment) => segment.startsWith('SPM'));
  const orc = segments.find((segment) => segment.startsWith('ORC'));
  const nte = segments.find((segment) => segment.startsWith('NTE'));
  if (!pid) throw new Error('HL7 order has no PID segment.');
  if (!obr) throw new Error('HL7 order has no OBR segment.');

  const messageType = field(msh, 8) || 'ORM^O01';
  const patientName = field(pid, 5).split('^');
  const lastName = patientName[0]?.trim();
  const firstName = patientName[1]?.trim();
  if (!lastName || !firstName) throw new Error('PID-5 must contain family and given names.');

  const dob = compactDate(field(pid, 7));
  const clinicianName = nameFromXcn(field(obr, 16) || field(orc, 12));
  const history =
    field(obr, 13).trim() ||
    field(nte, 3).trim() ||
    'Clinical history supplied with an HL7 v2 order.';

  return {
    messageType,
    controlId: field(msh, 9) || `HL7-${Date.now()}`,
    patient: {
      firstName,
      lastName,
      sex: sexFromHl7(field(pid, 8)),
      dateOfBirth: dob,
      ...(dob ? {} : { age: ageFromHl7(field(pid, 7)) }),
      phone: field(pid, 13) || undefined,
      address: field(pid, 11) || undefined,
      mrn: field(pid, 3) || undefined,
    },
    referringClinician: {
      name: clinicianName || 'External referring clinician',
      facility: field(obr, 21) || undefined,
      phone: undefined,
    },
    priority: priorityFromHl7(field(obr, 5)),
    specimenType: component(field(spm, 4)) || 'Histopathology specimen',
    site: component(field(spm, 8)) || component(field(obr, 15)) || 'Not specified',
    clinicalHistory: history.slice(0, 5_000),
    clinicalDiagnosis: field(obr, 13) ? field(obr, 13).trim().slice(0, 2_000) : undefined,
    orderId: field(obr, 2) || field(orc, 2) || undefined,
  };
}

export function stripMllp(value: string): string {
  let result = value.trim();
  if (result.startsWith('\u000b')) result = result.slice(1);
  if (result.endsWith('\u001c\r')) result = result.slice(0, -2);
  else if (result.endsWith('\u001c')) result = result.slice(0, -1);
  if (result.startsWith('\u000b')) result = result.slice(1);
  return result.trim();
}

export function wrapMllp(value: string): string {
  return `\u000b${value}\u001c\r`;
}

function field(segment: string | undefined, position: number): string {
  if (!segment) return '';
  const parts = segment.split('|');
  return parts[position] ?? '';
}

function component(value: string): string {
  const parts = value.split('^');
  return parts[1]?.trim() || parts[0]?.trim() || '';
}

function nameFromXcn(value: string): string {
  if (!value) return '';
  const parts = value.split('^');
  const family = parts[1]?.trim() ?? '';
  const given = parts[2]?.trim() ?? '';
  const prefix = parts[5]?.trim() ?? '';
  return [prefix, given, family].filter(Boolean).join(' ');
}

function sexFromHl7(value: string): Sex {
  switch (value.trim().toUpperCase()) {
    case 'M':
      return 'MALE';
    case 'F':
      return 'FEMALE';
    case 'O':
      return 'OTHER';
    default:
      return 'UNKNOWN';
  }
}

function priorityFromHl7(value: string): Priority {
  const upper = value.trim().toUpperCase();
  if (upper === 'S' || upper.includes('STAT') || upper.includes('FROZEN')) return 'FROZEN';
  if (upper === 'U' || upper.includes('URGENT')) return 'URGENT';
  return 'ROUTINE';
}

function compactDate(value: string): string | undefined {
  const compact = value.trim().slice(0, 8);
  if (!/^\d{8}$/.test(compact)) return undefined;
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function ageFromHl7(value: string): number | undefined {
  const compact = value.trim().slice(0, 8);
  if (!/^\d{8}$/.test(compact)) return undefined;
  const birth = new Date(
    Number(compact.slice(0, 4)),
    Number(compact.slice(4, 6)) - 1,
    Number(compact.slice(6, 8)),
  );
  const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 86_400_000));
  return age >= 0 && age <= 130 ? age : undefined;
}
