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

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

function placeholderMismatch(placeholders: readonly string[], values: number): Error {
  return structuredError(
    'RUNTIME.PARAM_PLACEHOLDER_MISMATCH',
    `The MySQL statement writes placeholders ${JSON.stringify(placeholders)} for ${values} parameter value(s); write each value as a numbered ?N, or every value as a bare ? in order, and no other placeholder.`,
    {
      why: 'A placeholder that does not match a value binds a value to the wrong place in the statement, or leaves a value unbound.',
      fix: 'Pass values into raw SQL through interpolation rather than writing a `?` in the SQL text.',
      meta: { placeholders, params: values },
    },
  );
}

interface Token {
  readonly text: string;
  readonly placeholder: boolean;
}

/** The statement split into placeholders and the text between them; a `?` inside a quoted string, a backtick identifier or a comment is text. */
function tokenize(sql: string): Token[] {
  const tokens: Token[] = [];
  let text = '';
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
      while (isDigit(sql[end])) end += 1;
      tokens.push({ text, placeholder: false }, { text: sql.slice(i, end), placeholder: true });
      text = '';
      i = end;
      continue;
    }
    text += sql.slice(i, end);
    i = end;
  }
  tokens.push({ text, placeholder: false });
  return tokens;
}

/** The index into `values` each placeholder takes: `?N` takes value N, and bare `?`s take the values in order. */
function valueIndexes(placeholders: readonly string[], values: number): number[] {
  const numbered = placeholders.filter((placeholder) => placeholder.length > 1);
  if (numbered.length === 0) {
    if (placeholders.length !== values) throw placeholderMismatch(placeholders, values);
    return placeholders.map((_, index) => index);
  }
  const indexes = placeholders.map((placeholder) => Number(placeholder.slice(1)) - 1);
  const valid =
    numbered.length === placeholders.length &&
    indexes.every((index) => Number.isSafeInteger(index) && index >= 0 && index < values) &&
    new Set(indexes).size === values;
  if (!valid) throw placeholderMismatch(placeholders, values);
  return indexes;
}

/**
 * Writes each value into its placeholder, escaped by mysql2. The adapter writes numbered `?N` placeholders, N counting from 1, and a value may be written more than once; the control plane writes bare `?`s, which take the values in order. A `?` inside a quoted string, a backtick identifier or a comment is text, not a placeholder: mysql2's own substitution does not know that, so text holding a `?` would take a value and let it run as SQL. Refuses a statement that mixes the two forms, or whose placeholders and values do not match.
 */
export function formatMysqlQuery(sql: string, values: readonly unknown[]): string {
  const tokens = tokenize(sql);
  const placeholders = tokens.filter((token) => token.placeholder).map((token) => token.text);
  const indexes = valueIndexes(placeholders, values.length);
  let next = 0;
  return tokens
    .map((token) => {
      if (!token.placeholder) return token.text;
      const index = indexes[next++] ?? 0;
      return literal(values[index], index);
    })
    .join('');
}
