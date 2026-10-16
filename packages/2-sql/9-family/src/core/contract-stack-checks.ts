import { ContractValidationError } from '@internal/contract/contract-validation-error';
import type { Contract } from '@internal/contract/types';
import { collectScalarTypeConstructors } from '@internal/framework-components/authoring';
import {
  type CodecLookupWithDescriptors,
  type DataTypeLookup,
  dataTypeParamsOf,
} from '@internal/framework-components/codec';
import type { AssembledAuthoringContributions } from '@internal/framework-components/control';
import {
  isStorageTypeInstance,
  resolvedTypeParams,
  type SqlModelStorage,
  type SqlStorage,
  type StorageTable,
} from '@internal/sql-contract/types';
import { valueObjectStorageTypeMissingMessage } from '@internal/sql-contract/validators';
import { blindCast } from '@internal/utils/casts';
import { isInternalError } from '@internal/utils/internal-error';

export interface ContractStackCheckInputs {
  readonly codecLookup: CodecLookupWithDescriptors;
  readonly dataTypes: { readonly lookup: DataTypeLookup };
  readonly authoringContributions: Pick<
    AssembledAuthoringContributions,
    'type' | 'valueObjectStorageType'
  >;
}

function tablesOf(storage: SqlStorage) {
  return Object.entries(storage.namespaces).flatMap(([namespaceId, namespace]) =>
    Object.entries(namespace.entries['table'] ?? {}).map(([tableName, table]) => ({
      path: `storage.namespaces.${namespaceId}.entries.table.${tableName}`,
      namespaceId,
      tableName,
      table: blindCast<StorageTable, 'entries.table of a hydrated SQL namespace'>(table),
    })),
  );
}

function dataTypeProblems(
  storage: SqlStorage,
  codecLookup: CodecLookupWithDescriptors,
): readonly string[] {
  const typed = [
    ...tablesOf(storage).flatMap(({ path, table }) =>
      Object.entries(table.columns).map(([columnName, column]) => ({
        path: `${path}.columns.${columnName}`,
        codecId: column.codecId,
        dataType: column.dataType,
      })),
    ),
    ...Object.entries(storage.types ?? {}).flatMap(([typeName, entry]) =>
      isStorageTypeInstance(entry)
        ? [{ path: `storage.types.${typeName}`, codecId: entry.codecId, dataType: entry.dataType }]
        : [],
    ),
  ];
  return typed.flatMap(({ path, codecId, dataType }) => {
    const represented = codecLookup.descriptorFor(codecId)?.dataType;
    if (represented === undefined || represented === dataType) return [];
    return [`${path}: codec ${codecId} represents ${represented}, not ${dataType}`];
  });
}

/** Each literal default the column's type does not hold, under the column's parameters, element by element on a list column. */
function defaultProblems(storage: SqlStorage, dataTypes: DataTypeLookup): readonly string[] {
  return tablesOf(storage).flatMap(({ path, table }) =>
    Object.entries(table.columns).flatMap(([columnName, column]) => {
      const columnDefault = column.default;
      if (columnDefault?.kind !== 'literal') return [];
      const type = dataTypes.get(column.dataType);
      if (type === undefined) return [];
      const params = dataTypeParamsOf(type, resolvedTypeParams(column, storage.types));
      const values =
        column.many !== undefined && column.many !== false && Array.isArray(columnDefault.value)
          ? columnDefault.value.filter((element) => element !== null)
          : [columnDefault.value];
      for (const value of values) {
        try {
          type.fromContract(value, params);
        } catch (error) {
          if (isInternalError(error)) throw error;
          const reason = error instanceof Error ? error.message : String(error);
          return [
            `${path}.columns.${columnName}: the default ${JSON.stringify(value)} is not a value of ${type.id}: ${reason}`,
          ];
        }
      }
      return [];
    }),
  );
}

function valueObjectProblems(
  contract: Contract<SqlStorage>,
  authoring: ContractStackCheckInputs['authoringContributions'],
): readonly string[] {
  const storageTypeName = authoring.valueObjectStorageType;
  const expectedCodecId =
    storageTypeName === undefined
      ? undefined
      : collectScalarTypeConstructors(authoring.type).get(storageTypeName)?.codecId;
  const tables = new Map(
    tablesOf(contract.storage).map((entry) => [`${entry.namespaceId}\0${entry.tableName}`, entry]),
  );
  return Object.values(contract.domain.namespaces).flatMap((namespace) =>
    Object.values(namespace.models).flatMap((model) => {
      const storage = blindCast<SqlModelStorage, 'SQL contract model storage'>(model.storage);
      const table = tables.get(`${storage.namespaceId}\0${storage.table}`);
      if (table === undefined) return [];
      return Object.entries(model.fields).flatMap(([fieldName, field]) => {
        if (field.type.kind !== 'valueObject') return [];
        const columnName = storage.fields[fieldName]?.column;
        const column = columnName === undefined ? undefined : table.table.columns[columnName];
        if (columnName === undefined || column === undefined) return [];
        const path = `${table.path}.columns.${columnName}`;
        if (expectedCodecId === undefined) {
          return [valueObjectStorageTypeMissingMessage(path)];
        }
        if (column.codecId === expectedCodecId) return [];
        return [
          `${path}: a value-object column uses codec ${expectedCodecId}, the codec of the stack's value-object storage type ${storageTypeName}, not ${column.codecId}`,
        ];
      });
    }),
  );
}

/**
 * Checks a deserialized contract against the stack that loads it: each column's codec represents the data type the column names, each value-object column uses the codec of the stack's value-object storage type, and each literal default is a value of its column's type under the column's parameters.
 */
export function assertContractMatchesStack(
  contract: Contract<SqlStorage>,
  stack: ContractStackCheckInputs,
): void {
  const problems = [
    ...dataTypeProblems(contract.storage, stack.codecLookup),
    ...valueObjectProblems(contract, stack.authoringContributions),
    ...defaultProblems(contract.storage, stack.dataTypes.lookup),
  ];
  if (problems.length > 0) {
    throw new ContractValidationError(problems.join('; '), 'storage');
  }
}
