import type { Contract } from '@internal/contract/types';
import { type SqlStorage, StorageTable } from '@internal/sql-contract/types';

/** A column of a table in a storage namespace. */
export interface TableColumn {
  readonly namespaceId: string;
  readonly table: string;
  readonly column: string;
}

/**
 * The columns whose values come from a value set, such as the column of an enum field. No value of
 * a type stands in for every member of a set, so the planners give these columns no temporary value.
 */
export function valueSetColumns(contract: Contract<SqlStorage>): readonly TableColumn[] {
  return Object.entries(contract.storage.namespaces).flatMap(([namespaceId, namespace]) =>
    Object.entries(namespace.entries['table'] ?? {}).flatMap(([table, node]) =>
      StorageTable.is(node)
        ? Object.entries(node.columns)
            .filter(([, column]) => column.valueSet !== undefined)
            .map(([column]) => ({ namespaceId, table, column }))
        : [],
    ),
  );
}
