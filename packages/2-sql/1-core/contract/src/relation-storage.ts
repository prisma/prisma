import type { Contract, ContractToOneRelation } from '@internal/contract/types';
import { blindCast } from '@internal/utils/casts';
import type { SqlModelStorage, SqlStorage, StorageTable } from './types';

export type SqlToOneRelationStorage = {
  /** False for the back side of a 1:1, whose local columns are the table's primary key. */
  readonly ownsForeignKey: boolean;
  /** One entry per local field; a column that cannot be resolved counts as nullable. */
  readonly columns: readonly { readonly name: string; readonly nullable: boolean }[];
};

function sameColumnSet(left: readonly string[], right: readonly string[]): boolean {
  const rightSet = new Set(right);
  return left.length === rightSet.size && left.every((column) => rightSet.has(column));
}

/**
 * The storage facts behind a same-space to-one relation's nullability: which side owns the
 * foreign key, and whether each local column is nullable.
 */
export function resolveSqlToOneRelationStorage(
  contract: Contract<SqlStorage>,
  modelStorage: SqlModelStorage,
  relation: ContractToOneRelation,
): SqlToOneRelationStorage {
  const table = blindCast<
    StorageTable | undefined,
    'storage table entries are validated against the storage table schema before this runs'
  >(contract.storage.namespaces[modelStorage.namespaceId]?.entries.table?.[modelStorage.table]);
  const columns = relation.on.localFields.map((fieldName) => {
    const columnName = modelStorage.fields[fieldName]?.column;
    const column = columnName === undefined ? undefined : table?.columns[columnName];
    return { name: columnName ?? fieldName, nullable: column?.nullable ?? true };
  });
  const primaryKeyColumns = table?.primaryKey?.columns;
  const ownsForeignKey = !(
    relation.cardinality === '1:1' &&
    primaryKeyColumns !== undefined &&
    sameColumnSet(
      columns.map((column) => column.name),
      primaryKeyColumns,
    )
  );
  return { ownsForeignKey, columns };
}
