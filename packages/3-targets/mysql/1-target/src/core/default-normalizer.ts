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
  | { readonly kind: 'literal'; readonly literal: ReportedLiteralDefault };

function extraFlags(extra: string): readonly string[] {
  return extra.toLowerCase().split(/\s+/);
}

/**
 * Reads a column's reported default from `COLUMN_DEFAULT` and `EXTRA`. `auto_increment` is `autoincrement()`; an expression default that writes the current time, such as `CURRENT_TIMESTAMP(3)`, is `now()`; any other expression default is a function default kept as reported; and anything else is a literal. `undefined` when the column has no default.
 */
export function readMysqlDefault(
  columnDefault: string | null,
  extra: string,
): MysqlReportedDefault | undefined {
  const flags = extraFlags(extra);
  if (flags.includes('auto_increment')) return AUTOINCREMENT;
  if (columnDefault === null) return undefined;
  if (flags.includes('default_generated')) {
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
