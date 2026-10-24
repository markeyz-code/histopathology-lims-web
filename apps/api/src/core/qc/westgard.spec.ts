import { evaluateWestgard } from './westgard';

describe('Westgard QC evaluation', () => {
  const mean = 140;
  const sd = 2;

  it('accepts control results within limits', () => {
    const result = evaluateWestgard([140, 141, 139], mean, sd);
    expect(result.status).toBe('ACCEPTED');
    expect(result.violations).toHaveLength(0);
  });

  it('rejects a 1-3s violation', () => {
    const result = evaluateWestgard([140, 147], mean, sd);
    expect(result.status).toBe('REJECTED');
    expect(result.violations.some((violation) => violation.rule === '1_3S')).toBe(true);
  });

  it('detects 2-2s and R-4s patterns', () => {
    expect(evaluateWestgard([145, 145.5], mean, sd).violations.some((v) => v.rule === '2_2S')).toBe(
      true,
    );
    expect(evaluateWestgard([145.2, 137], mean, sd).violations.some((v) => v.rule === 'R_4S')).toBe(
      true,
    );
  });

  it('detects 4-1s and 10x trends', () => {
    expect(
      evaluateWestgard([142.1, 142.5, 143, 143.5], mean, sd).violations.some(
        (v) => v.rule === '4_1S',
      ),
    ).toBe(true);
    expect(
      evaluateWestgard(
        [141, 141, 141, 141, 141, 141, 141, 141, 141, 141],
        mean,
        sd,
      ).violations.some((v) => v.rule === '10X'),
    ).toBe(true);
  });
});
