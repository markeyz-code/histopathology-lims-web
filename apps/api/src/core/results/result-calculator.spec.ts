import { calculateAnalytes, evaluateFormula } from './result-calculator';
import type { AnalyteDefinition, ResultValue } from '@lims/shared';

describe('calculated result fields', () => {
  const analytes: AnalyteDefinition[] = [
    {
      key: 'creatinine',
      name: 'Creatinine',
      unit: 'µmol/L',
      resultType: 'NUMERIC',
      referenceRanges: [],
    },
    {
      key: 'ratio',
      name: 'Ratio',
      unit: null,
      resultType: 'CALCULATED',
      formula: 'creatinine / 2',
      referenceRanges: [],
    },
  ];

  it('evaluates arithmetic without eval', () => {
    expect(
      evaluateFormula(
        '(a + b) / 2',
        new Map([
          ['a', 10],
          ['b', 20],
        ]),
      ),
    ).toBe(15);
    expect(evaluateFormula('a / 0', new Map([['a', 10]]))).toBeNull();
    expect(evaluateFormula('missing + 1', new Map())).toBeNull();
  });

  it('fills calculated analytes from numeric inputs', () => {
    const values: ResultValue[] = [
      {
        analyteKey: 'creatinine',
        value: 90,
        unit: 'µmol/L',
        flag: 'NORMAL',
        critical: false,
        referenceText: null,
      },
      {
        analyteKey: 'ratio',
        value: null,
        unit: null,
        flag: 'NORMAL',
        critical: false,
        referenceText: null,
      },
    ];
    const calculated = calculateAnalytes(analytes, values);
    expect(calculated.find((value) => value.analyteKey === 'ratio')?.value).toBe(45);
  });
});
