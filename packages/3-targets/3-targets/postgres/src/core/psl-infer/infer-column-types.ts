import type { SqlPslBuildContext } from '@internal/family-sql/control';
import type { DataType } from '@internal/framework-components/codec';
import {
  type ResolvedSqlType,
  resolveReportedSqlType,
  resolveWrittenSqlTypes,
} from '@internal/sql-contract/data-type';
import type { SqlColumnIR } from '@internal/sql-schema-ir/types';
import { InternalError } from '@internal/utils/internal-error';
import { postgresError } from '../errors';
import {
  fewestArgumentsCall,
  inferredTypeConstructors,
} from '../psl-build/inferred-type-constructors';
import type { InferredPslType } from './infer-default-codec';

/** The type `contract infer` writes for a column that is not an enum. */
export type InferredColumnTypes = (
  tableName: string,
  columnName: string,
) => Required<InferredPslType>;

/** One table `contract infer` writes, with the schema it was introspected from. */
export interface InferredTable {
  readonly schemaName: string;
  readonly tableName: string;
  readonly columns: readonly SqlColumnIR[];
}

/**
 * The data type of `column` with its parameters in normal form: read from the type the database
 * reported when introspection recorded one, otherwise from `nativeType`, the column's type as a
 * migration writes it, when exactly one data type reads that text.
 */
function resolveColumnType(
  column: SqlColumnIR,
  dataTypes: readonly DataType[],
): ResolvedSqlType | undefined {
  if (column.reportedType !== undefined) {
    return resolveReportedSqlType(column.reportedType, dataTypes);
  }
  const written = resolveWrittenSqlTypes(column.nativeType, dataTypes);
  return written.length === 1 ? written[0] : undefined;
}

/**
 * The type of every column of `tables` that `isEnumColumn` does not claim: the call, with the
 * fewest arguments, to the constructor marked `inferred` for the data type that claims the
 * column's reported type. When any column has no such call, throws
 * `CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED` listing every one of them.
 */
export function inferColumnTypes(input: {
  readonly tables: readonly InferredTable[];
  readonly context: SqlPslBuildContext;
  readonly isEnumColumn: (column: SqlColumnIR) => boolean;
}): InferredColumnTypes {
  const constructors = inferredTypeConstructors({
    authoringTypes: input.context.authoringContributions.type,
    codecLookup: input.context.codecLookup,
    dataTypeLookup: input.context.dataTypes.lookup,
  });
  const dataTypes = [...constructors.values()].map((marked) => marked.dataType);
  const types = new Map<string, Required<InferredPslType>>();
  const unclaimed: string[] = [];
  for (const { schemaName, tableName, columns } of input.tables) {
    for (const column of columns) {
      if (input.isEnumColumn(column)) continue;
      const resolved = resolveColumnType(column, dataTypes);
      const marked = resolved && constructors.get(resolved.dataType);
      const call = resolved && marked && fewestArgumentsCall(marked, resolved.typeParams);
      if (call === undefined) {
        unclaimed.push(
          `${schemaName}.${tableName}.${column.name}: ${column.reportedType?.text ?? column.nativeType}${column.many === true ? '[]' : ''}`,
        );
        continue;
      }
      types.set(JSON.stringify([tableName, column.name]), {
        path: call.path,
        args: call.args.map(String),
      });
    }
  }
  if (unclaimed.length > 0) {
    const columns = unclaimed.sort();
    throw postgresError(
      'CONTRACT.INFER_COLUMN_TYPE_UNCLAIMED',
      [
        'contract infer: no data type in the configured stack claims these column types:',
        ...columns.map((line) => `  ${line}`),
      ].join('\n'),
      {
        why: 'Prisma 8 reads a column type only through a data type that the target or an extension pack declares.',
        fix: 'Add the extension pack that declares the type to `extensionPacks` in the config, or change the column to a type Prisma 8 supports.',
        meta: { columns },
      },
    );
  }
  return (tableName, columnName) => {
    const type = types.get(JSON.stringify([tableName, columnName]));
    if (type === undefined) {
      throw new InternalError(
        `contract infer resolved no type for "${tableName}"."${columnName}".`,
      );
    }
    return type;
  };
}
