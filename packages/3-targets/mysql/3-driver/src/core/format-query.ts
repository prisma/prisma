import { structuredError } from '@internal/utils/structured-error';
import { escape as escapeValue } from 'mysql2';

function invalid(message: string, meta: Record<string, unknown>): Error {
  return structuredError('RUNTIME.AST_INVALID', message, { meta: { target: 'mysql', ...meta } });
}

function literal(value: unknown, index: number): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw invalid(`MySQL has no literal for the parameter value ${value}`, { index });
  }
  const isBytes = value instanceof Uint8Array;
  const isPlainValue =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean' ||
    value instanceof Date;
  if (!isBytes && !isPlainValue) {
    throw invalid(
      'A MySQL parameter must be text, a number, a bigint, a boolean, a Date, bytes or null',
      { index, valueType: Array.isArray(value) ? 'array' : typeof value },
    );
  }
  return escapeValue(isBytes ? Buffer.from(value) : value, false, 'Z');
}

/** The index just past the quoted text that opens at `start` with `quote`, where a doubled quote stays inside and, unless `quote` is a backtick, a backslash escapes the next character. */
function endOfQuoted(sql: string, start: number, quote: string): number {
  let i = start + 1;
  while (i < sql.length) {
    const char = sql[i];
    if (char === '\\' && quote !== '`') {
      i += 2;
    } else if (char === quote) {
      if (sql[i + 1] !== quote) return i + 1;
      i += 2;
    } else {
      i += 1;
    }
  }
  return sql.length;
}

function endOfLine(sql: string, start: number): number {
  const end = sql.indexOf('\n', start);
  return end === -1 ? sql.length : end;
}

function opensDashComment(sql: string, i: number): boolean {
  if (sql[i] !== '-' || sql[i + 1] !== '-') return false;
  const next = sql[i + 2];
  return next === undefined || /\s/.test(next);
}

/**
 * Writes each value into the `?` it belongs to, escaped by mysql2. A `?` inside a quoted string, a backtick identifier or a comment is text, not a placeholder; mysql2's own substitution does not know that, so text holding a `?` would take a value and let it run as SQL. Refuses a statement whose placeholders and values differ in number.
 */
export function formatMysqlQuery(sql: string, values: readonly unknown[]): string {
  let out = '';
  let placeholders = 0;
  let i = 0;
  while (i < sql.length) {
    const char = sql[i];
    let end = i + 1;
    if (char === "'" || char === '"' || char === '`') {
      end = endOfQuoted(sql, i, char);
    } else if (char === '#' || opensDashComment(sql, i)) {
      end = endOfLine(sql, i);
    } else if (char === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      end = close === -1 ? sql.length : close + 2;
    } else if (char === '?') {
      if (placeholders < values.length) out += literal(values[placeholders], placeholders);
      placeholders += 1;
      i = end;
      continue;
    }
    out += sql.slice(i, end);
    i = end;
  }
  if (placeholders !== values.length) {
    throw invalid(
      `The statement has ${placeholders} placeholders but ${values.length} parameter values`,
      { placeholders, values: values.length },
    );
  }
  return out;
}
