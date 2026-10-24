import type { AnalyteDefinition, ResultValue } from '@lims/shared';

/**
 * Tiny arithmetic evaluator for calculated analytes. Supports numbers,
 * analyte keys, + - * / and parentheses. No eval/Function is used.
 */
export function evaluateFormula(formula: string, values: Map<string, number>): number | null {
  const tokens = formula.match(/\d+(?:\.\d+)?|[a-zA-Z_][a-zA-Z0-9_]*|[()+\-*/]/g);
  if (!tokens) return null;
  let index = 0;

  function parseExpression(): number | null {
    let left = parseTerm();
    while (left !== null && (tokens![index] === '+' || tokens![index] === '-')) {
      const op = tokens![index++];
      const right = parseTerm();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }
  function parseTerm(): number | null {
    let left = parseFactor();
    while (left !== null && (tokens![index] === '*' || tokens![index] === '/')) {
      const op = tokens![index++];
      const right = parseFactor();
      if (right === null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }
  function parseFactor(): number | null {
    const token = tokens![index++];
    if (!token) return null;
    if (token === '(') {
      const value = parseExpression();
      if (tokens![index] !== ')') return null;
      index += 1;
      return value;
    }
    if (token === '-') {
      const value = parseFactor();
      return value === null ? null : -value;
    }
    if (/^\d/.test(token)) return Number(token);
    const value = values.get(token);
    return value === undefined || Number.isNaN(value) ? null : value;
  }

  const result = parseExpression();
  if (index !== tokens.length || result === null || !Number.isFinite(result)) return null;
  return result;
}

export function calculateAnalytes(
  analytes: AnalyteDefinition[],
  values: ResultValue[],
): ResultValue[] {
  const numeric = new Map<string, number>();
  for (const value of values) {
    if (typeof value.value === 'number') numeric.set(value.analyteKey, value.value);
    else if (
      typeof value.value === 'string' &&
      value.value.trim() !== '' &&
      Number.isFinite(Number(value.value))
    ) {
      numeric.set(value.analyteKey, Number(value.value));
    }
  }
  return values.map((value) => {
    const definition = analytes.find((analyte) => analyte.key === value.analyteKey);
    if (!definition?.formula) return value;
    const calculated = evaluateFormula(definition.formula, numeric);
    return { ...value, value: calculated };
  });
}
