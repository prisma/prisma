import { placeholderNumber, tokenizeMysqlSql } from '@internal/target-mysql/sql-utils';
import { structuredError } from '@internal/utils/structured-error';
import { escape as escapeValue } from 'mysql2';

function invalid(message: string, meta: Record<string, unknown>): Error {
  return structuredError('RUNTIME.AST_INVALID', message, { meta: { target: 'mysql', ...meta } });
}

/**
 * A string literal with its quotes and backslashes doubled. With `NO_BACKSLASH_ESCAPES` off, MySQL reads `\\` as one backslash and `''` as one quote; with it on, it reads `\\` as two backslashes, which changes the value but cannot end the literal. mysql2 escapes a quote as `\'`, which a session that turned the mode on would read as a backslash and the end of the literal.
 */
function quoteString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
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
  if (typeof value === 'string') return quoteString(value);
  return escapeValue(isBytes ? Buffer.from(value) : value, false, 'Z');
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

/** The index into `values` each placeholder takes: `?N` takes value N, and bare `?`s take the values in order. */
function valueIndexes(placeholders: readonly string[], values: number): number[] {
  if (placeholders.every((placeholder) => placeholder === '?')) {
    if (placeholders.length !== values) throw placeholderMismatch(placeholders, values);
    return placeholders.map((_, index) => index);
  }
  const indexes = placeholders.map((placeholder) => (placeholderNumber(placeholder) ?? 0) - 1);
  const valid =
    indexes.every((index) => index >= 0 && index < values) && new Set(indexes).size === values;
  if (!valid) throw placeholderMismatch(placeholders, values);
  return indexes;
}

/**
 * Writes each value into its placeholder, escaped by mysql2. The adapter writes numbered `?N` placeholders, N counting from 1, and a value may be written more than once; the control plane writes bare `?`s, which take the values in order. `tokenizeMysqlSql` reads the statement as MySQL's lexer does, so a `?` inside a quoted string, a backtick identifier or a comment is text, which mysql2's own substitution does not know. Refuses a statement that mixes the two forms, or whose placeholders and values do not match.
 */
export function formatMysqlQuery(sql: string, values: readonly unknown[]): string {
  const tokens = tokenizeMysqlSql(sql);
  const placeholders = tokens
    .filter((token) => token.kind === 'placeholder')
    .map((token) => token.text);
  const indexes = valueIndexes(placeholders, values.length);
  let next = 0;
  return tokens
    .map((token) => {
      if (token.kind === 'text') return token.text;
      const index = indexes[next++] ?? 0;
      return literal(values[index], index);
    })
    .join('');
}
