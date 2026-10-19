import type { DataType } from '@internal/framework-components/codec';
import type { SqlColumnIRInput } from '@internal/sql-schema-ir/types';
import { resolveReportedSqlType, resolveWrittenSqlTypes } from '../src/sql-data-type';

/** `column` as introspection builds it: the type its `reportedType` reports, or else the type its `nativeType` names by any text one of `dataTypes` writes, reports or claims. */
export function introspectedColumn(
  column: SqlColumnIRInput,
  dataTypes: readonly DataType[],
): SqlColumnIRInput {
  const resolved =
    column.reportedType === undefined
      ? resolveWrittenSqlTypes(column.nativeType, dataTypes)[0]
      : resolveReportedSqlType(column.reportedType, dataTypes);
  const type = dataTypes.find(({ id }) => id === resolved?.dataType);
  return {
    reportedType: { text: column.nativeType, kind: undefined, schema: undefined, name: undefined },
    ...column,
    ...(resolved === undefined || type === undefined
      ? {}
      : { dataType: type, storedType: type, typeParams: resolved.typeParams }),
  };
}
