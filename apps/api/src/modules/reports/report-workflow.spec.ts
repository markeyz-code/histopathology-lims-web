import {
  canAmendReport,
  checkSignOut,
  generateNarrative,
  isReportEditable,
  protocolContentSchema,
  reportCompleteness,
  validateReportData,
  type ProtocolContent,
  type ReportData,
} from '@lims/shared';

const content: ProtocolContent = protocolContentSchema.parse({
  schemaVersion: 1,
  title: 'Test carcinoma — synoptic report',
  cancerType: 'Test carcinoma',
  subspecialty: 'Breast',
  sections: [
    {
      key: 'tumour',
      title: 'Tumour',
      fields: [
        {
          key: 'grade',
          label: 'Grade',
          type: 'select',
          required: true,
          options: [
            { value: '1', label: 'Grade 1' },
            { value: '2', label: 'Grade 2' },
          ],
        },
        {
          key: 'size',
          label: 'Size',
          type: 'number',
          unit: 'mm',
          required: true,
          min: 1,
          max: 500,
        },
        {
          key: 'lvsi',
          label: 'Lymphovascular invasion',
          type: 'boolean',
          required: true,
        },
        {
          key: 'margins',
          label: 'Margins',
          type: 'multiselect',
          required: false,
          options: [
            { value: 'clear', label: 'Clear' },
            { value: 'close', label: 'Close' },
          ],
        },
      ],
    },
    {
      key: 'diagnosis',
      title: 'Diagnosis',
      fields: [
        {
          key: 'diagnosis',
          label: 'Final diagnosis',
          type: 'textarea',
          required: true,
        },
      ],
    },
  ],
});

const completeData: ReportData = {
  grade: '2',
  size: 22,
  lvsi: false,
  margins: ['clear'],
  diagnosis: 'Invasive carcinoma, grade 2, 22 mm, margins clear.',
};

describe('report sign-out policy', () => {
  it('blocks sign-out while required fields are missing and names them', () => {
    const result = checkSignOut('DRAFT', content, { grade: '2' });
    expect(result.ok).toBe(false);
    expect(result.missingRequired).toEqual(
      expect.arrayContaining(['Size', 'Lymphovascular invasion', 'Final diagnosis']),
    );
    expect(result.reason).toContain('Complete all required fields');
  });

  it('allows sign-out only when the report is a complete draft', () => {
    expect(checkSignOut('DRAFT', content, completeData)).toEqual({
      ok: true,
      missingRequired: [],
    });
    const completeness = reportCompleteness(content, completeData);
    expect(completeness.complete).toBe(true);
    expect(completeness.requiredCompleted).toBe(4);
  });

  it('locks signed and amended reports against direct edits', () => {
    const signed = checkSignOut('SIGNED_OUT', content, completeData);
    expect(signed.ok).toBe(false);
    expect(signed.reason).toContain('amendment');
    expect(checkSignOut('AMENDED', content, completeData).ok).toBe(false);
    expect(isReportEditable('DRAFT')).toBe(true);
    expect(isReportEditable('SIGNED_OUT')).toBe(false);
    expect(canAmendReport('SIGNED_OUT')).toBe(true);
    expect(canAmendReport('AMENDED')).toBe(true);
    expect(canAmendReport('DRAFT')).toBe(false);
  });

  it('normalises values and rejects invalid types and options', () => {
    const result = validateReportData(content, {
      grade: '9',
      size: 'not a number',
      lvsi: 'yes',
      margins: ['invalid-option'],
      diagnosis: 42,
      unknownField: 'discarded',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((issue) => issue.fieldKey)).toEqual(
      expect.arrayContaining(['grade', 'size', 'lvsi', 'diagnosis']),
    );
    expect(result.data.unknownField).toBeUndefined();
  });

  it('generates a narrative from structured values', () => {
    const narrative = generateNarrative(content, completeData);
    expect(narrative).toContain('TEST CARCINOMA — SYNOPTIC REPORT');
    expect(narrative).toContain('Grade: Grade 2');
    expect(narrative).toContain('Size: 22 mm');
    expect(narrative).toContain('Lymphovascular invasion: No');
    expect(narrative).toContain('Margins: Clear');
    expect(narrative).toContain('Final diagnosis: Invasive carcinoma');
  });
});
