import type { DataType } from '@internal/framework-components/codec';
import type { AdapterDescriptor } from '@internal/framework-components/components';
import {
  resolveReportedSqlType,
  resolveWrittenSqlTypes,
  type SqlTypeLookups,
} from '@internal/sql-contract/data-type';
import type { SqlColumnIRInput } from '@internal/sql-schema-ir/types';
import { createPostgresBuiltinCodecLookup } from '../src/core/codec-registry';
import { codecDescriptors } from '../src/core/codecs';
import { createPostgresBuiltinDataTypeLookup, postgresDataTypes } from '../src/core/data-types';

export const postgresTypeLookups: SqlTypeLookups = {
  codecLookup: createPostgresBuiltinCodecLookup(),
  dataTypeLookup: createPostgresBuiltinDataTypeLookup(),
};

const postgresTypesComponent: AdapterDescriptor<'sql', 'postgres'> = {
  kind: 'adapter',
  id: 'postgres-test-types',
  version: '0.0.0-test',
  familyId: 'sql',
  targetId: 'postgres',
  dataTypes: postgresDataTypes,
  types: { codecTypes: { codecDescriptors } },
};

/** Framework components that register the Postgres codecs and data types, for planner and diff tests. */
export const postgresTypeComponents: readonly AdapterDescriptor<'sql', 'postgres'>[] = [
  postgresTypesComponent,
];

/** `column` as introspection builds it: the type its `reportedType` reports, or else the type its `nativeType` names by any text one of `dataTypes` writes, reports or claims. */
export function introspectedColumn(
  column: SqlColumnIRInput,
  dataTypes: readonly DataType[] = postgresDataTypes,
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
