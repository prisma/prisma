import { sqlBuiltinGeneratorDescriptors, sqlDefaultFunctions } from '@internal/family-sql/control';
import type {
  ControlMutationDefaultEntry,
  MutationDefaultGeneratorDescriptor,
} from '@internal/framework-components/control';
import { timestampNowControlDescriptor } from '@internal/framework-components/control';
import { sqliteInteger } from '@internal/target-sqlite/data-types';

const sqliteDefaultFunctionRegistryEntries = Object.entries(
  sqlDefaultFunctions({ integer: sqliteInteger.id }),
) satisfies ReadonlyArray<readonly [string, ControlMutationDefaultEntry]>;

export function createSqliteDefaultFunctionRegistry(): ReadonlyMap<
  string,
  ControlMutationDefaultEntry
> {
  return new Map(sqliteDefaultFunctionRegistryEntries);
}

export function createSqliteMutationDefaultGeneratorDescriptors(): readonly MutationDefaultGeneratorDescriptor[] {
  return [...sqlBuiltinGeneratorDescriptors({ uuid: [] }), timestampNowControlDescriptor()];
}
