import type { ContractWithDomain } from '@internal/contract/types';
import {
  fieldStatementText,
  type MigrationTemporaryValue,
} from '@internal/framework-components/control';

/** A new required field whose existing rows a plan gives one temporary value, as a statement names it. */
export interface TemporaryValueReport {
  readonly field: string;
  /** The value as SQL text, such as `''` or `0`. */
  readonly value: string;
}

/** The fields of `values` named as `destination` names them; a column no field stores is left out. */
export function reportTemporaryValues(
  values: readonly MigrationTemporaryValue[],
  destination: ContractWithDomain,
): readonly TemporaryValueReport[] {
  return values.flatMap(({ subject, value }) =>
    subject.kind === 'field' ? [{ field: fieldStatementText(destination, subject), value }] : [],
  );
}
