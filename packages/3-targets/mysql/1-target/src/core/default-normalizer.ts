/**
 * Reading the default a MySQL column reports in `information_schema.COLUMNS`. MySQL 8 reports a literal default unquoted in `COLUMN_DEFAULT`, which is the text the driver hands `fromWire` for a row of the column, and marks an expression default with `DEFAULT_GENERATED` in `EXTRA`. An `auto_increment` column reports its numbering in `EXTRA` and no default.
 */

import type { ColumnDefault } from '@internal/contract/types';
import type { DefaultResolverColumn, ReportedLiteralDefault } from '@internal/family-sql/control';

const AUTOINCREMENT = { kind: 'function', expression: 'autoincrement()' } as const;
const NOW = { kind: 'function', expression: 'now()' } as const;
const CURRENT_TIMESTAMP =
  /^(?:current_timestamp|now|localtime|localtimestamp)(?:\s*\(\s*\d*\s*\))?$/i;

/** What a column's reported default is: a function, or a literal the column's codec reads. */
export type MysqlReportedDefault =
  | { readonly kind: 'function'; readonly expression: string }
  | {
      readonly kind: 'literal';
      readonly literal: Extract<ReportedLiteralDefault, { readonly kind: 'value' }> & {
        readonly body: string;
      };
    };

const SQL_ESCAPES: Readonly<Record<string, string>> = {
  '0': '\0',
  b: '\b',
  n: '\n',
  r: '\r',
  t: '\t',
  Z: '\x1a',
};

const INTRODUCED_STRING = /^_[A-Za-z0-9]+'/;

function withoutBackslashEscapes(text: string): string {
  return text.replace(/\\(.)/gs, '$1');
}

/** The text of a MySQL string literal whose opening quote ends `start`, when the literal runs to the end of `text`. */
function stringLiteralBody(text: string, start: number): string | undefined {
  let body = '';
  for (let index = start; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (char === '\\') {
      index += 1;
      const escaped = text.charAt(index);
      body +=
        escaped === '%' || escaped === '_' ? `\\${escaped}` : (SQL_ESCAPES[escaped] ?? escaped);
    } else if (char === "'" && text.charAt(index + 1) === "'") {
      body += "'";
      index += 1;
    } else if (char === "'") {
      return index === text.length - 1 ? body : undefined;
    } else {
      body += char;
    }
  }
  return undefined;
}

/**
 * The value of a default MySQL reports as a string with a character set introducer, such as `_utf8mb4\'abc\'`: the form a literal default on a text, blob or JSON column takes, because MySQL writes it as an expression. `undefined` for any other expression.
 */
function introducedStringValue(reported: string): string | undefined {
  const expression = withoutBackslashEscapes(reported.trim());
  const opening = INTRODUCED_STRING.exec(expression);
  return opening === null ? undefined : stringLiteralBody(expression, opening[0].length);
}

function extraFlags(extra: string): readonly string[] {
  return extra.toLowerCase().split(/\s+/);
}

/**
 * Reads a column's reported default from `COLUMN_DEFAULT` and `EXTRA`. `auto_increment` is `autoincrement()`; a string with a character set introducer, the form MySQL reports for a literal default on a text, blob or JSON column, is that literal; an expression default that writes the current time, such as `CURRENT_TIMESTAMP(3)`, is `now()`; any other expression default is a function default kept as reported; and anything else is a literal. `undefined` when the column has no default.
 */
export function readMysqlDefault(
  columnDefault: string | null,
  extra: string,
): MysqlReportedDefault | undefined {
  const flags = extraFlags(extra);
  if (flags.includes('auto_increment')) return AUTOINCREMENT;
  if (columnDefault === null) return undefined;
  if (flags.includes('default_generated')) {
    const introduced = introducedStringValue(columnDefault);
    if (introduced !== undefined) {
      return { kind: 'literal', literal: { kind: 'value', body: introduced } };
    }
    const expression = columnDefault.trim();
    return CURRENT_TIMESTAMP.test(expression) ? NOW : { kind: 'function', expression };
  }
  return { kind: 'literal', literal: { kind: 'value', body: columnDefault } };
}

/**
 * Names a contract's expression default the way {@link readMysqlDefault} names the same function in the database, so `` sql`CURRENT_TIMESTAMP(3)` `` and the database's `now()` compare equal. Every other default passes through unchanged.
 */
export function mysqlResolveDefault(
  def: ColumnDefault,
  _column: DefaultResolverColumn,
): ColumnDefault {
  if (def.kind !== 'function') return def;
  return CURRENT_TIMESTAMP.test(def.expression.trim()) ? NOW : def;
}
