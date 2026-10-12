import { asNamespaceId, type ContractWithDomain } from '@internal/contract/types';
import type { MigrationSubject } from '@internal/framework-components/control';
import { type } from 'arktype';
import { isSqlModelStorage } from './statement-planning';
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
  if (cast === undefined) return undefined;
  const { table, column } = cast;
  const fields = Object.entries(contract.domain.namespaces).flatMap(([namespaceId, namespace]) =>
    Object.entries(namespace.models).flatMap(([model, definition]) => {
      const { storage } = definition;
      if (!isSqlModelStorage(storage) || storage.table !== table) return [];
      const field = Object.entries(storage.fields).find(([, stored]) => stored.column === column);
      if (field === undefined) return [];
      return [
        {
          storageNamespace: storage.namespaceId,
          isRoot: definition.base === undefined,
          subject: {
            kind: 'field' as const,
            namespaceId: asNamespaceId(namespaceId),
            model,
            field: field[0],
          },
        },
      ];
    }),
  );
  if (new Set(fields.map(({ storageNamespace }) => storageNamespace)).size !== 1) return undefined;
  return (fields.find(({ isRoot }) => isRoot) ?? fields[0])?.subject;
}
