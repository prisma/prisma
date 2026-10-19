import type { DataType } from '@internal/framework-components/codec';
import { resolveReportedSqlType } from '@internal/sql-contract/data-type';
import type { ReportedSqlType, SqlColumnIRInput } from '@internal/sql-schema-ir/types';

/**
 * The data type that claims an introspected column's reported type, with its parameters in normal form, over `dataTypes`, the stack's declared data types in assembly order. Empty when no data type claims it. Each adapter spreads it into the column it builds. ADR 254.
 */
export function resolveIntrospectedColumnType(
  reported: ReportedSqlType,
  dataTypes: readonly DataType[],
): Pick<SqlColumnIRInput, 'dataType' | 'typeParams'> {
  const resolved = resolveReportedSqlType(reported, dataTypes);
  const dataType =
    resolved === undefined ? undefined : dataTypes.find((type) => type.id === resolved.dataType);
  return resolved === undefined || dataType === undefined
    ? {}
    : { dataType, typeParams: resolved.typeParams };
}
