import type { DataType } from '@internal/framework-components/codec';
import { createDataTypeLookup } from '@internal/framework-components/codec';
import type { TargetBoundComponentDescriptor } from '@internal/framework-components/components';
import {
  resolveReportedSqlType,
  resolveWrittenSqlTypes,
  type SqlTypeLookups,
} from '@internal/sql-contract/data-type';
import type { SqlColumnIRInput } from '@internal/sql-schema-ir/types';
import { createSqliteBuiltinCodecLookup } from '../src/core/codec-registry';
import { sqliteDataTypes } from '../src/core/data-types';
import { sqliteCodecDescriptorRegistry } from '../src/core/registry';

export const sqliteTestTypes: SqlTypeLookups = {
  codecLookup: createSqliteBuiltinCodecLookup(),
  dataTypeLookup: createDataTypeLookup(sqliteDataTypes),
};

export const sqliteTestComponents: ReadonlyArray<TargetBoundComponentDescriptor<'sql', 'sqlite'>> =
  [
    {
      kind: 'adapter',
      familyId: 'sql',
      targetId: 'sqlite',
      id: 'sqlite-test-types',
      version: '0.0.0',
      dataTypes: sqliteDataTypes,
      types: {
        codecTypes: { codecDescriptors: [...sqliteCodecDescriptorRegistry.values()] },
      },
    },
  ];

/** `column` as introspection builds it: the type its `reportedType` reports, or else the type its `nativeType` names by any text one of `dataTypes` writes, reports or claims. */
export function introspectedColumn(
  column: SqlColumnIRInput,
  dataTypes: readonly DataType[] = sqliteDataTypes,
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
