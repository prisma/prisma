import { structuredError } from '@internal/utils/structured-error';

const QUOTE_CLOSERS: Readonly<Record<string, string>> = {
  "'": "'",
  '"': '"',
  '`': '`',
  '[': ']',
};

function skipQuoted(sql: string, start: number, closer: string): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === closer) {
      if (closer !== ']' && sql[index + 1] === closer) {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return index;
}

function skipUntil(sql: string, start: number, terminator: string): number {
  const end = sql.indexOf(terminator, start);
  return end === -1 ? sql.length : end + terminator.length;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

/** The `?` placeholders in SQLite SQL text, in the order written, skipping quoted text, quoted identifiers and comments. */
export function scanPlaceholders(sql: string): string[] {
  const placeholders: string[] = [];
  let index = 0;
  while (index < sql.length) {
    const char = sql[index] ?? '';
    const closer = QUOTE_CLOSERS[char];
    if (closer !== undefined) {
      index = skipQuoted(sql, index, closer);
    } else if (sql.startsWith('--', index)) {
      index = skipUntil(sql, index + 2, '\n');
    } else if (sql.startsWith('/*', index)) {
      index = skipUntil(sql, index + 2, '*/');
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

function placeholdersMatchParams(placeholders: readonly string[], paramCount: number): boolean {
  const numbers = placeholders.map((placeholder) =>
    Number(NUMBERED_PLACEHOLDER.exec(placeholder)?.[1] ?? Number.NaN),
  );
  return (
    numbers.every((number) => number >= 1 && number <= paramCount) &&
    new Set(numbers).size === paramCount
  );
}

export function assertPlaceholdersMatchParams(sql: string, paramCount: number): void {
  const placeholders = scanPlaceholders(sql);
  if (placeholdersMatchParams(placeholders, paramCount)) return;
  throw structuredError(
    'RUNTIME.PARAM_PLACEHOLDER_MISMATCH',
    `The lowered SQLite statement writes placeholders ${JSON.stringify(placeholders)} for ${paramCount} parameter(s); each parameter must be written as its own numbered placeholder, and no other placeholder may appear.`,
    {
      why: 'A placeholder that does not match a parameter binds a value to the wrong place in the statement, or leaves a value unbound.',
      fix: 'Pass values into raw SQL through interpolation rather than writing a `?` in the SQL text.',
      meta: { placeholders, params: paramCount },
    },
  );
}
