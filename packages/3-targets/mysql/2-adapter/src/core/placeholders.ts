import { structuredError } from '@internal/utils/structured-error';

/** The index just past the quoted text that opens at `start`, where a doubled quote stays inside and, outside a backtick identifier, a backslash escapes the next character. */
function endOfQuoted(sql: string, start: number, quote: string): number {
  let index = start + 1;
  while (index < sql.length) {
    const char = sql[index];
    if (char === '\\' && quote !== '`') {
      index += 2;
    } else if (char === quote) {
      if (sql[index + 1] !== quote) return index + 1;
      index += 2;
    } else {
      index += 1;
    }
  }
  return sql.length;
}

function endOf(sql: string, start: number, terminator: string): number {
  const end = sql.indexOf(terminator, start);
  return end === -1 ? sql.length : end + terminator.length;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

/** The `?` placeholders in MySQL SQL text, in the order written, skipping quoted strings, backtick identifiers and `#`, `-- ` and block comments. */
export function scanPlaceholders(sql: string): string[] {
  const placeholders: string[] = [];
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    if (char === "'" || char === '"' || char === '`') {
      index = endOfQuoted(sql, index, char);
    } else if (
      char === '#' ||
      (sql.startsWith('--', index) && /^\s?$/.test(sql[index + 2] ?? ''))
    ) {
      index = endOf(sql, index, '\n');
    } else if (sql.startsWith('/*', index)) {
      index = endOf(sql, index + 2, '*/');
    } else if (char === '?') {
      let end = index + 1;
      while (isDigit(sql[end])) end += 1;
      placeholders.push(sql.slice(index, end));
      index = end;
    } else {
      index += 1;
    }
  }
  return placeholders;
}

const NUMBERED_PLACEHOLDER = /^\?([1-9]\d*)$/;

/** Refuses a lowered statement unless every placeholder is a numbered `?N` naming one of its parameters and every parameter has a placeholder. */
export function assertPlaceholdersMatchParams(sql: string, paramCount: number): void {
  const placeholders = scanPlaceholders(sql);
  const numbers = placeholders.map((placeholder) =>
    Number(NUMBERED_PLACEHOLDER.exec(placeholder)?.[1] ?? Number.NaN),
  );
  const matches =
    numbers.every((number) => number >= 1 && number <= paramCount) &&
    new Set(numbers).size === paramCount;
  if (matches) return;
  throw structuredError(
    'RUNTIME.PARAM_PLACEHOLDER_MISMATCH',
    `The lowered MySQL statement writes placeholders ${JSON.stringify(placeholders)} for ${paramCount} parameter(s); each parameter must be written as its own numbered placeholder, and no other placeholder may appear.`,
    {
      why: 'A placeholder that does not match a parameter binds a value to the wrong place in the statement, or leaves a value unbound.',
      fix: 'Pass values into raw SQL through interpolation rather than writing a `?` in the SQL text.',
      meta: { placeholders, params: paramCount },
    },
  );
}
