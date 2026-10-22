import { quoteIdentifier } from '../../sql-utils';
import { buildTargetDetails } from '../planner-target-details';
import { type Op, step } from './shared';
import { columnAcceptsNullCheck } from './structure-checks';

/** A stored value as operation ids, labels and step descriptions write it. */
export function storedValueText(value: string | number): string {
  return JSON.stringify(value);
}

function idText(value: string | number): string {
  return String(value);
}

function valueAbsentCheck(tableName: string, columnName: string, value: string | number) {
  return step(
    `verify no row of "${tableName}" holds value ${storedValueText(value)} in column "${columnName}"`,
    `SELECT NOT EXISTS (SELECT 1 FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier(columnName)} = ?1) AS result`,
    [value],
  );
}

export function replaceStoredValue(
  tableName: string,
  columnName: string,
  from: string | number,
  to: string | number,
): Op {
  const column = quoteIdentifier(columnName);
  return {
    id: `replaceStoredValue.${tableName}.${columnName}.${idText(from)}`,
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

export function removeStoredValue(
  tableName: string,
  columnName: string,
  value: string | number,
): Op {
  const column = quoteIdentifier(columnName);
  return {
    id: `removeStoredValue.${tableName}.${columnName}.${idText(value)}`,
    label: `Remove value ${storedValueText(value)} from column "${columnName}" of "${tableName}"`,
    operationClass: 'destructive',
    target: { id: 'sqlite', details: buildTargetDetails('column', columnName, tableName) },
    precheck: [
      columnAcceptsNullCheck(
        tableName,
        columnName,
        `ensure column "${columnName}" of "${tableName}" accepts NULL, which removing a value from it writes`,
      ),
    ],
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
