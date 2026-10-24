import { parseAstm, parseHl7Oru } from './instrument.parser';

describe('instrument message parsing', () => {
  it('parses ASTM O/R records', () => {
    const message = [
      'H|\\^&|||Analyzer^1|LIMS',
      'P|1||MRN-1||Doe^Jane',
      'O|1|HAE-2026-000001|||',
      'R|1|^^^HB^Haemoglobin|11.8|g/dL||N',
      'R|2|^^^WBC^White cell count|6.4|10^9/L||N',
      'L|1|N',
    ].join('\r');
    const parsed = parseAstm(message);
    expect(parsed.protocol).toBe('ASTM');
    expect(parsed.accessionNumber).toBe('HAE-2026-000001');
    expect(parsed.patientName).toBe('Doe Jane');
    expect(parsed.values).toHaveLength(2);
    expect(parsed.values[0]).toEqual({ code: 'HB', value: '11.8', unit: 'g/dL' });
  });

  it('parses HL7 ORU OBX results', () => {
    const message = [
      'MSH|^~\\&|ANALYZER|LAB|LIMS|HOSP|20260101120000||ORU^R01|1|P|2.5',
      'PID|1||MRN-1||Doe^Jane',
      'OBR|1||HAE-2026-000002|FBC^Full blood count',
      'OBX|1|NM|HB^Haemoglobin||13.4|g/dL|13-17|N|||F',
      'OBX|2|NM|WBC^White cell count||5.8|10^9/L|4-11|N|||F',
    ].join('\r');
    const parsed = parseHl7Oru(`\x0b${message}\x1c\r`);
    expect(parsed.protocol).toBe('HL7');
    expect(parsed.accessionNumber).toBe('HAE-2026-000002');
    expect(parsed.patientName).toBe('Doe Jane');
    expect(parsed.values).toHaveLength(2);
    expect(parsed.values[1]?.code).toBe('WBC');
  });
});
