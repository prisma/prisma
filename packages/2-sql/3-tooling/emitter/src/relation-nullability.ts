import type { ContractModel, ContractRelation } from '@internal/contract/types';
import { entityAt } from '@internal/framework-components/ir';
import type { SqlModelStorage, SqlStorage, StorageTable } from '@internal/sql-contract/types';

function sameColumns(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((column, i) => column === b[i]);
}

/**
 * Whether a to-one relation on `model` may be absent. Mirrors the SQL ORM's
 * `IsToOneRelationNullable`: the relation is non-nullable only when this model's table owns a
 * foreign key over exactly the relation's local columns and none of those columns is nullable.
 */
export function isSqlToOneRelationNullable(
  model: ContractModel<SqlModelStorage>,
  relation: ContractRelation,
  storage: SqlStorage | undefined,
): boolean {
  if (!('on' in relation) || relation.on === undefined || storage === undefined) return true;
  const { table: tableName, namespaceId, fields } = model.storage;
  if (tableName === undefined || namespaceId === undefined) return true;
  const table = entityAt<StorageTable>(storage, {
    namespaceId,
    entityKind: 'table',
    entityName: tableName,
  });
  if (table === undefined) return true;
  const columns = relation.on.localFields.map((field) => fields?.[field]?.column ?? field);
  const ownsForeignKey = (table.foreignKeys ?? []).some((fk) =>
    sameColumns(fk.source.columns, columns),
  );
  if (!ownsForeignKey) return true;
  return columns.some((column) => {
    const storageColumn = table.columns[column];
    return storageColumn === undefined || storageColumn.nullable === true;
  });
}
