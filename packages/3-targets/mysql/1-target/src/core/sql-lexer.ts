import { mysqlError } from './errors';

/** A run of SQL text, or a `?` placeholder with the digits that follow it. */
export interface MysqlSqlToken {
  readonly kind: 'text' | 'placeholder';
  readonly text: string;
}

/** The index just past the quoted text that opens at `start`, where a doubled quote stays inside and, outside a backtick identifier, a backslash escapes the next character. The session clears `NO_BACKSLASH_ESCAPES` and `ANSI_QUOTES`, so MySQL reads quotes the same way. */
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

/** MySQL opens a `--` comment when the next character is whitespace or a control character, or the text ends: `my_isspace` or `my_iscntrl` in its lexer. */
function opensDashComment(sql: string, index: number): boolean {
  if (!sql.startsWith('--', index)) return false;
  const next = sql.charCodeAt(index + 2);
  return Number.isNaN(next) || next <= 0x20 || next === 0x7f;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

/**
 * Splits MySQL SQL text into text and `?` placeholders, as MySQL's lexer reads it: a `?` inside a quoted string, a backtick identifier or a `#`, `--` or block comment is text. Refuses an executable `/*!` comment, whose content MySQL runs as SQL and whose strings the comment's closing marker does not end.
 */
export function tokenizeMysqlSql(sql: string): MysqlSqlToken[] {
  const tokens: MysqlSqlToken[] = [];
  let text = '';
  let index = 0;
  while (index < sql.length) {
    const char = sql[index];
    let end = index + 1;
    if (char === "'" || char === '"' || char === '`') {
      end = endOfQuoted(sql, index, char);
    } else if (char === '#' || opensDashComment(sql, index)) {
      end = endOf(sql, index, '\n');
    } else if (sql.startsWith('/*!', index)) {
      throw mysqlError(
        'RUNTIME.AST_INVALID',
        'A MySQL statement may not contain an executable /*! comment, whose content MySQL runs as SQL',
        { meta: { target: 'mysql', position: index } },
      );
    } else if (sql.startsWith('/*', index)) {
      end = endOf(sql, index + 2, '*/');
    } else if (char === '?') {
      while (isDigit(sql[end])) end += 1;
      tokens.push({ kind: 'text', text }, { kind: 'placeholder', text: sql.slice(index, end) });
      text = '';
      index = end;
      continue;
    }
    text += sql.slice(index, end);
    index = end;
  }
  tokens.push({ kind: 'text', text });
  return tokens;
}

const NUMBERED_PLACEHOLDER = /^\?([1-9]\d*)$/;

/** The 1-based number of a `?N` placeholder, or `undefined` for a bare `?` or one with a leading zero. */
export function placeholderNumber(placeholder: string): number | undefined {
  const digits = NUMBERED_PLACEHOLDER.exec(placeholder)?.[1];
  return digits === undefined ? undefined : Number(digits);
}
