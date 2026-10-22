import { type } from 'arktype';
import type { SqlMigrationPlanOperationStep } from './types';

const RowsHoldingValueMeta = type({
  rowsHoldingValue: { enumValue: 'string', value: 'string | number' },
});

/** The enum value a removal check guards, and its stored value as the contract stores it. */
export interface RowsHoldingValueMark {
  readonly enumValue: string;
  readonly value: string | number;
}

/**
 * The meta of the check before a stored enum value is removed from a column: it fails while rows
 * hold the value in a column that takes no NULL, and the runner then counts those rows.
 */
export function rowsHoldingValueMeta(mark: RowsHoldingValueMark): {
  readonly rowsHoldingValue: RowsHoldingValueMark;
} {
  return { rowsHoldingValue: { enumValue: mark.enumValue, value: mark.value } };
}

/** The enum value a check guards, as {@link rowsHoldingValueMeta} marks it. */
export function rowsHoldingValueOf(
  step: SqlMigrationPlanOperationStep,
): RowsHoldingValueMark | undefined {
  const meta = RowsHoldingValueMeta(step.meta ?? {});
  return meta instanceof type.errors ? undefined : meta.rowsHoldingValue;
}

/** What a runner failure says of the rows that hold a stored value a column cannot lose. */
export function rowsHoldingValueSummary(
  mark: RowsHoldingValueMark,
  table: string,
  column: string,
  rows: number,
): string {
  const counted = `${rows} ${rows === 1 ? 'row' : 'rows'} of "${table}"`;
  return `${counted} ${rows === 1 ? 'holds' : 'hold'} ${JSON.stringify(mark.value)} in column "${column}", which takes no NULL, so enum value "${mark.enumValue}" cannot be removed.`;
}
