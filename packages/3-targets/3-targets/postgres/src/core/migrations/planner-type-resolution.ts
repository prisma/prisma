import type { StorageColumn, StorageTypeInstance } from '@internal/sql-contract/types';

export type ResolvedColumnTypeMetadata = Pick<
  StorageColumn,
  'nativeType' | 'codecId' | 'typeParams'
>;

export function resolveColumnTypeMetadata(
  column: StorageColumn,
  storageTypes: Readonly<Record<string, StorageTypeInstance>>,
): ResolvedColumnTypeMetadata {
  if (!column.typeRef) {
    return column;
  }

  const referencedType = storageTypes[column.typeRef];
  if (!referencedType) {
    return column;
  }

  return {
    codecId: referencedType.codecId,
    nativeType: referencedType.nativeType,
    typeParams: referencedType.typeParams,
  };
}
