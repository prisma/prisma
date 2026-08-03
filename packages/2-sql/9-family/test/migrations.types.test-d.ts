/**
 * Type-level tests verifying SqlMigration* types extend core migration types.
 *
 * These tests ensure that the SQL family migration types are properly
 * compatible with the core framework migration types, allowing the CLI
 * to use core types while SQL-specific code uses the extended types.
 */

import type { Contract } from '@internal/contract/types';
import type {
  ContractSpace,
  ContractSpaceHeadRef,
  MigrationMetadata,
  MigrationPackage,
  MigrationPlan,
  MigrationPlannerConflict,
  MigrationPlanOperation,
  MigrationRunnerFailure,
  MigrationRunnerPerSpaceSuccessValue,
} from '@internal/framework-components/control';
import type { MigrationOps } from '@internal/migration-tools/package';
import { expectTypeOf } from 'vitest';
import type {
  SqlControlExtensionDescriptor,
  SqlMigrationPlan,
  SqlMigrationPlanOperation,
  SqlMigrationRunnerFailure,
  SqlMigrationRunnerSuccessValue,
  SqlPlannerConflict,
} from '../src/core/migrations/types';

// Note: SqlMigrationOperationClass is the same as core MigrationOperationClass (no SQL-specific extension)

// Test that SqlMigrationPlanOperation has the required core fields
expectTypeOf<SqlMigrationPlanOperation<unknown>['id']>().toExtend<MigrationPlanOperation['id']>();
expectTypeOf<SqlMigrationPlanOperation<unknown>['label']>().toExtend<
  MigrationPlanOperation['label']
>();
expectTypeOf<SqlMigrationPlanOperation<unknown>['operationClass']>().toExtend<
  MigrationPlanOperation['operationClass']
>();

// Test that SqlMigrationPlan extends core MigrationPlan
expectTypeOf<SqlMigrationPlan<unknown>>().toExtend<MigrationPlan>();

// Test that SqlPlannerConflict has the required core fields
expectTypeOf<SqlPlannerConflict['kind']>().toExtend<MigrationPlannerConflict['kind']>();
expectTypeOf<SqlPlannerConflict['summary']>().toExtend<MigrationPlannerConflict['summary']>();

// Test that SqlMigrationRunnerSuccessValue has the required core fields
expectTypeOf<SqlMigrationRunnerSuccessValue['operationsPlanned']>().toExtend<
  MigrationRunnerPerSpaceSuccessValue['operationsPlanned']
>();
expectTypeOf<SqlMigrationRunnerSuccessValue['operationsExecuted']>().toExtend<
  MigrationRunnerPerSpaceSuccessValue['operationsExecuted']
>();

// Test that SqlMigrationRunnerFailure has the required core fields
expectTypeOf<SqlMigrationRunnerFailure['code']>().toExtend<MigrationRunnerFailure['code']>();
expectTypeOf<SqlMigrationRunnerFailure['summary']>().toExtend<MigrationRunnerFailure['summary']>();

// Contract-space descriptor surface (project: extension contract spaces).
//
// `contractSpace` is the in-memory view a schema-contributing extension
// publishes via its descriptor module. The framework consumes it only at
// authoring time (`migrate`) — apply / verify paths read the user's repo.
// The shape locks down here so downstream emission, planning, and runner
// code can rely on it.
//
// The contract-space identity types live in
// `@internal/framework-components/control`; the SQL family specialises
// `ContractSpace` to a SQL contract while the framework-level type stays
// family-agnostic.
expectTypeOf<ContractSpaceHeadRef>().toEqualTypeOf<{
  readonly hash: string;
  readonly invariants: readonly string[];
}>();

expectTypeOf<MigrationPackage['dirName']>().toEqualTypeOf<string>();
expectTypeOf<MigrationPackage['metadata']>().toEqualTypeOf<MigrationMetadata>();
expectTypeOf<MigrationPackage['ops']>().toEqualTypeOf<MigrationOps>();

expectTypeOf<ContractSpace>().toExtend<{
  readonly contractJson: Contract;
  readonly migrations: readonly MigrationPackage[];
  readonly headRef: ContractSpaceHeadRef;
}>();

// `contractSpace` is optional on the descriptor (additive change — existing
// extensions without a contract space continue to typecheck unchanged).
// SQL family specialises the framework type to `Contract<SqlStorage>`.
expectTypeOf<SqlControlExtensionDescriptor<'postgres'>['contractSpace']>().toEqualTypeOf<
  ContractSpace<Contract<import('@internal/sql-contract/types').SqlStorage>> | undefined
>();
