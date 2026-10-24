import { evaluateCondition } from './rule-evaluator';
import type { RuleCondition } from '@lims/shared';

describe('safe rule evaluator', () => {
  const context = {
    testCode: 'FBC',
    values: { hb: { value: 9.2, flag: 'LOW', critical: false } },
    previous: { hb: 12.4 },
    delta: { hb: 3.2 },
    patient: { age: 46, sex: 'MALE' },
  };

  it('evaluates nested all/any/not conditions', () => {
    const condition: RuleCondition = {
      all: [
        { field: 'values.hb.flag', op: 'in', value: ['LOW', 'CRITICAL_LOW'] },
        {
          any: [
            { field: 'delta.hb', op: 'gt', value: 2 },
            { field: 'previous.hb', op: 'lt', value: 1 },
          ],
        },
        { not: { field: 'values.hb.critical', op: 'eq', value: true } },
      ],
    };
    expect(evaluateCondition(condition, context)).toBe(true);
  });

  it('supports between, contains, exists and comparisons', () => {
    expect(
      evaluateCondition({ field: 'patient.age', op: 'between', value: [18, 65] }, context),
    ).toBe(true);
    expect(evaluateCondition({ field: 'testCode', op: 'contains', value: 'fb' }, context)).toBe(
      true,
    );
    expect(evaluateCondition({ field: 'values.hb.value', op: 'exists' }, context)).toBe(true);
    expect(
      evaluateCondition({ field: 'values.missing', op: 'exists', value: false }, context),
    ).toBe(true);
    expect(evaluateCondition({ field: 'values.hb.value', op: 'gte', value: 9.2 }, context)).toBe(
      true,
    );
  });

  it('fails closed on unknown fields and malformed conditions', () => {
    expect(evaluateCondition({ field: 'values.unknown.value', op: 'gt', value: 1 }, context)).toBe(
      false,
    );
    expect(evaluateCondition({}, context)).toBe(false);
    expect(
      evaluateCondition({ field: 'patient.age', op: 'between', value: [70, 80] }, context),
    ).toBe(false);
  });
});
