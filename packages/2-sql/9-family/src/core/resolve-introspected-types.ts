import type { DataType } from '@internal/framework-components/codec';
import { resolveReportedSqlType } from '@internal/sql-contract/data-type';
import type { ReportedSqlType, SqlColumnIRInput } from '@internal/sql-schema-ir/types';

/**
 * The type an introspected column is stored as: the data type that claims its reported type, with its parameters in normal form, over `dataTypes`, the stack's declared data types in assembly order. Empty when no data type claims it. Each adapter spreads it into the column it builds. ADR 254.
 */
export function resolveIntrospectedColumnType(
  reported: ReportedSqlType,
  dataTypes: readonly DataType[],
): Pick<SqlColumnIRInput, 'storedType' | 'typeParams'> {
  const resolved = resolveReportedSqlType(reported, dataTypes);
  const dataType =
    resolved === undefined ? undefined : dataTypes.find((type) => type.id === resolved.dataType);
  return resolved === undefined || dataType === undefined
    ? {}
    : { storedType: dataType, typeParams: resolved.typeParams };
}
