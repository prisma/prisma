import type { ContractWithDomain } from '@internal/contract/types';
import type { MigrationSubject } from '@internal/framework-components/control';
import { type } from 'arktype';
import { fieldOfColumn } from './field-of-column';
import type { SqlMigrationPlanOperationStep } from './types';

const CastColumnMeta = type({ castColumn: { table: 'string', column: 'string' } });

/**
 * The meta of a step that converts the values of `column` in `table` to the column's new type with
 * the database's own cast, or checks that it did. When the step fails, the runner names the field
 * that stores the column.
 */
export function castColumnMeta(
  table: string,
  column: string,
): { readonly castColumn: { readonly table: string; readonly column: string } } {
  return { castColumn: { table, column } };
}

/** The column a step casts to its new type, as {@link castColumnMeta} marks it. */
export function castColumnOf(
  step: SqlMigrationPlanOperationStep,
): { readonly table: string; readonly column: string } | undefined {
  const meta = CastColumnMeta(step.meta ?? {});
  return meta instanceof type.errors ? undefined : meta.castColumn;
}

/**
 * The field of `contract` whose column a failed cast step converts, or undefined when the step
 * casts no column, no field stores the column, or tables of two storage namespaces share its name.
 */
export function unconvertedFieldOf(
  step: SqlMigrationPlanOperationStep,
  contract: ContractWithDomain,
): MigrationSubject | undefined {
  const cast = castColumnOf(step);
  return cast === undefined ? undefined : fieldOfColumn(contract, cast.table, cast.column);
}
