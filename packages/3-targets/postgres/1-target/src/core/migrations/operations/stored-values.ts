import type { JsonValue } from '@internal/contract/types';
import { quoteIdentifier } from '../../sql-utils';
import { qualifyTableName } from '../planner-sql-checks';
import { type Op, step, targetDetails } from './shared';

/** A stored value as operation ids, labels and step descriptions write it. */
export function storedValueText(value: JsonValue): string {
  return JSON.stringify(value);
}

function idText(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function holdingValue(column: string, many: boolean): string {
  return many ? `$1 = ANY(${column})` : `${column} = $1`;
}

function valueAbsentCheck(
  schemaName: string,
  tableName: string,
  columnName: string,
  value: JsonValue,
  many: boolean,
) {
  const column = quoteIdentifier(columnName);
  return step(
    many
      ? `verify no list in column "${columnName}" of "${tableName}" holds value ${storedValueText(value)}`
      : `verify no row of "${tableName}" holds value ${storedValueText(value)} in column "${columnName}"`,
    `SELECT NOT EXISTS (SELECT 1 FROM ${qualifyTableName(schemaName, tableName)} WHERE ${holdingValue(column, many)}) AS result`,
    [value],
  );
}

export function replaceValue(
  schemaName: string,
  tableName: string,
  columnName: string,
  from: JsonValue,
  to: JsonValue,
  many: boolean,
): Op {
  const column = quoteIdentifier(columnName);
  const replaced = many ? `array_replace(${column}, $1, $2)` : '$2';
  return {
    id: `replaceValue.${tableName}.${columnName}.${idText(from)}`,
    label: `Replace value ${storedValueText(from)} with ${storedValueText(to)} in column "${columnName}" of "${tableName}"`,
    operationClass: 'widening',
    target: targetDetails('column', columnName, schemaName, tableName),
    precheck: [],
    execute: [
      step(
        `replace value ${storedValueText(from)} with ${storedValueText(to)} in column "${columnName}"`,
        `UPDATE ${qualifyTableName(schemaName, tableName)} SET ${column} = ${replaced} WHERE ${holdingValue(column, many)}`,
        [from, to],
      ),
    ],
    postcheck: [valueAbsentCheck(schemaName, tableName, columnName, from, many)],
  };
}

export function removeValue(
  schemaName: string,
  tableName: string,
  columnName: string,
  value: JsonValue,
  many: boolean,
): Op {
  const column = quoteIdentifier(columnName);
  const removed = many ? `array_remove(${column}, $1)` : 'NULL';
  return {
    id: `removeValue.${tableName}.${columnName}.${idText(value)}`,
    label: `Remove value ${storedValueText(value)} from column "${columnName}" of "${tableName}"`,
    operationClass: 'destructive',
    target: targetDetails('column', columnName, schemaName, tableName),
    precheck: [],
    execute: [
      step(
        `remove value ${storedValueText(value)} from column "${columnName}"`,
        `UPDATE ${qualifyTableName(schemaName, tableName)} SET ${column} = ${removed} WHERE ${holdingValue(column, many)}`,
        [value],
      ),
    ],
    postcheck: [valueAbsentCheck(schemaName, tableName, columnName, value, many)],
  };
}
