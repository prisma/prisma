import type { JsonValue } from '@internal/contract/types';
import { quoteIdentifier } from '../../sql-utils';
import { buildTargetDetails } from '../planner-target-details';
import { type Op, step } from './shared';

/** A stored value as operation ids, labels and step descriptions write it. */
export function storedValueText(value: JsonValue): string {
  return JSON.stringify(value);
}

function idText(value: JsonValue): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function valueAbsentCheck(tableName: string, columnName: string, value: JsonValue) {
  return step(
    `verify no row of "${tableName}" holds value ${storedValueText(value)} in column "${columnName}"`,
    `SELECT NOT EXISTS (SELECT 1 FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(columnName)} = ?1) AS result`,
    [value],
  );
}

export function replaceValue(
  tableName: string,
  columnName: string,
  from: JsonValue,
  to: JsonValue,
): Op {
  const column = quoteIdentifier(columnName);
  return {
    id: `replaceValue.${tableName}.${columnName}.${idText(from)}`,
    label: `Replace value ${storedValueText(from)} with ${storedValueText(to)} in column "${columnName}" of "${tableName}"`,
    operationClass: 'widening',
    target: { id: 'sqlite', details: buildTargetDetails('column', columnName, tableName) },
    precheck: [],
    execute: [
      step(
        `replace value ${storedValueText(from)} with ${storedValueText(to)} in column "${columnName}"`,
        `UPDATE ${quoteIdentifier(tableName)} SET ${column} = ?2 WHERE ${column} = ?1`,
        [from, to],
      ),
    ],
    postcheck: [valueAbsentCheck(tableName, columnName, from)],
  };
}

export function removeValue(tableName: string, columnName: string, value: JsonValue): Op {
  const column = quoteIdentifier(columnName);
  return {
    id: `removeValue.${tableName}.${columnName}.${idText(value)}`,
    label: `Remove value ${storedValueText(value)} from column "${columnName}" of "${tableName}"`,
    operationClass: 'destructive',
    target: { id: 'sqlite', details: buildTargetDetails('column', columnName, tableName) },
    precheck: [],
    execute: [
      step(
        `remove value ${storedValueText(value)} from column "${columnName}"`,
        `UPDATE ${quoteIdentifier(tableName)} SET ${column} = NULL WHERE ${column} = ?1`,
        [value],
      ),
    ],
    postcheck: [valueAbsentCheck(tableName, columnName, value)],
  };
}
