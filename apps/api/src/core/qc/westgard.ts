import type { QcStatus, WestgardRule } from '@lims/shared';

export interface WestgardViolation {
  rule: WestgardRule;
  message: string;
}

export function evaluateWestgard(
  values: number[],
  mean: number,
  sd: number,
): {
  status: QcStatus;
  violations: WestgardViolation[];
  points: Array<{ value: number; z: number }>;
} {
  const points = values.map((value) => ({ value, z: sd === 0 ? 0 : (value - mean) / sd }));
  const violations: WestgardViolation[] = [];

  if (points.some((point) => Math.abs(point.z) > 3)) {
    violations.push({ rule: '1_3S', message: 'One control result is beyond ±3 SD.' });
  }
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (previous.z > 2 && current.z > 2) {
      violations.push({ rule: '2_2S', message: 'Two consecutive controls are beyond +2 SD.' });
      break;
    }
    if (previous.z < -2 && current.z < -2) {
      violations.push({ rule: '2_2S', message: 'Two consecutive controls are beyond −2 SD.' });
      break;
    }
  }
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (Math.abs(current.z - previous.z) > 4) {
      violations.push({
        rule: 'R_4S',
        message: 'The range between consecutive controls exceeds 4 SD.',
      });
      break;
    }
  }
  for (let index = 3; index < points.length; index += 1) {
    const window = points.slice(index - 3, index + 1);
    if (window.every((point) => point.z > 1)) {
      violations.push({ rule: '4_1S', message: 'Four consecutive controls are beyond +1 SD.' });
      break;
    }
    if (window.every((point) => point.z < -1)) {
      violations.push({ rule: '4_1S', message: 'Four consecutive controls are beyond −1 SD.' });
      break;
    }
  }
  for (let index = 9; index < points.length; index += 1) {
    const window = points.slice(index - 9, index + 1);
    if (window.every((point) => point.z > 0) || window.every((point) => point.z < 0)) {
      violations.push({
        rule: '10X',
        message: 'Ten consecutive controls are on one side of the mean.',
      });
      break;
    }
  }

  const rejected = violations.some((violation) =>
    ['1_3S', '2_2S', 'R_4S', '10X'].includes(violation.rule),
  );
  return {
    status: rejected ? 'REJECTED' : violations.length > 0 ? 'WARNING' : 'ACCEPTED',
    violations,
    points,
  };
}
