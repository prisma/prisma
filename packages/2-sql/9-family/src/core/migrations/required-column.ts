import type { ContractWithDomain } from '@internal/contract/types';
import type { RowsWithoutValue } from '@internal/framework-components/control';
import { type } from 'arktype';
import type { SqlMigrationPlanOperationStep } from './types';
import { fieldOfColumn } from './unconverted-field';

const RequiredColumnMeta = type({
  requiredColumn: { table: 'string', column: 'string', reason: "'nullValues' | 'newField'" },
});

/** Where a column that is to become required finds no value. */
export interface RequiredColumn {
  readonly table: string;
  readonly column: string;
  readonly reason: RowsWithoutValue['reason'];
}

/**
 * The meta of a step that fails when rows have no value for a column that is to become required:
 * rows hold NULL in it, or, for a new column that can be added to an empty table only, the table
 * has rows. When the step fails, the runner counts those rows.
 */
export function requiredColumnMeta(
  table: string,
  column: string,
  reason: RowsWithoutValue['reason'],
): { readonly requiredColumn: RequiredColumn } {
  return { requiredColumn: { table, column, reason } };
}

/** The column a step checks before it becomes required, as {@link requiredColumnMeta} marks it. */
export function requiredColumnOf(step: SqlMigrationPlanOperationStep): RequiredColumn | undefined {
  const meta = RequiredColumnMeta(step.meta ?? {});
  return meta instanceof type.errors ? undefined : meta.requiredColumn;
}

/** What a runner failure says of the rows a column that is to become required has no value in. */
export function rowsWithoutValueSummary(required: RequiredColumn, rows: number): string {
  const { table, column } = required;
  if (required.reason === 'newField') {
    return `"${table}" has ${rows} ${rows === 1 ? 'row' : 'rows'}, so the new required column "${column}" cannot be added: it can be added to an empty table only.`;
  }
  return `${rows} ${rows === 1 ? 'row' : 'rows'} of "${table}" ${rows === 1 ? 'holds' : 'hold'} NULL in "${column}", so it cannot become required.`;
}

/**
 * A runner failure's summary and report for `rows` rows that `required` has no value in, naming the
 * field of `contract` that stores the column; undefined when no row lacks a value.
 */
export function rowsWithoutValueFailure(
  required: RequiredColumn,
  rows: number,
  plan: { readonly contract: ContractWithDomain; readonly operationIndex: number },
): { readonly summary: string; readonly report: RowsWithoutValue } | undefined {
  if (rows === 0) return undefined;
  return {
    summary: rowsWithoutValueSummary(required, rows),
    report: {
      field: fieldOfColumn(plan.contract, required.table, required.column),
      reason: required.reason,
      rows,
      operationIndex: plan.operationIndex,
    },
  };
}
