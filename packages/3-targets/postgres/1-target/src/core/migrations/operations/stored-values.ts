import type { ExecuteRequestLowerer } from '@internal/family-sql/control-adapter';
import { columnNullabilityAst } from '../../../contract-free/checks';
import { quoteIdentifier } from '../../sql-utils';
import { qualifyTableName } from '../planner-sql-checks';
import { type Op, step, targetDetails } from './shared';

/** A stored value as operation ids, labels and step descriptions write it. */
export function storedValueText(value: string | number): string {
  return JSON.stringify(value);
}

function idText(value: string | number): string {
  return String(value);
}

function holdingValue(column: string, many: boolean): string {
  return many ? `$1 = ANY(${column})` : `${column} = $1`;
}

function valueAbsentCheck(
  schemaName: string,
  tableName: string,
  columnName: string,
  value: string | number,
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

export function replaceStoredValue(
  schemaName: string,
  tableName: string,
  columnName: string,
  from: string | number,
  to: string | number,
  many: boolean,
): Op {
  const column = quoteIdentifier(columnName);
  const replaced = many ? `array_replace(${column}, $1, $2)` : '$2';
  return {
    id: `replaceStoredValue.${tableName}.${columnName}.${idText(from)}`,
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

export async function removeStoredValue(
  schemaName: string,
  tableName: string,
  columnName: string,
  value: string | number,
  many: boolean,
  lowerer: ExecuteRequestLowerer,
): Promise<Op> {
  const column = quoteIdentifier(columnName);
  const removed = many ? `array_remove(${column}, $1)` : 'NULL';
  const acceptsNull = many
    ? []
    : [
        await lowerer.lowerToExecuteRequest(
          columnNullabilityAst({
            schema: schemaName,
            table: tableName,
            column: columnName,
            nullable: true,
          }),
        ),
      ];
  return {
    id: `removeStoredValue.${tableName}.${columnName}.${idText(value)}`,
    label: `Remove value ${storedValueText(value)} from column "${columnName}" of "${tableName}"`,
    operationClass: 'destructive',
    target: targetDetails('column', columnName, schemaName, tableName),
    precheck: acceptsNull.map((check) =>
      step(
        `ensure column "${columnName}" of "${tableName}" accepts NULL, which removing a value from it writes`,
        check.sql,
        check.params,
      ),
    ),
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
