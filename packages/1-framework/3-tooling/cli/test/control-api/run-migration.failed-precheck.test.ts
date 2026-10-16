/**
 * A check that fails before an operation runs: the run failure names the check and says whether the space had a marker, so the advice can tell a replay on an adopted database from drift.
 */
import type {
  ControlDriverInstance,
  ControlFamilyInstance,
  MigrationPlan,
  MigrationRunnerFailure,
  MigrationRunnerResult,
  TargetMigrationsCapability,
} from '@internal/framework-components/control';
import type {
  AggregateContractSpace,
  ContractSpaceAggregate,
  PerSpacePlan,
} from '@internal/migration-tools/aggregate';
import {
  buildFabricatedMigrationEdge,
  createContractSpaceAggregate,
} from '@internal/migration-tools/aggregate';
import { notOk } from '@internal/utils/result';
import { describe, expect, it, vi } from 'vitest';
import { runMigration } from '../../src/control-api/operations/run-migration';

const APP_HASH = `${'a'.repeat(64)}`;

function makeAppSpace(): AggregateContractSpace {
  const contract = {
    storage: { storageHash: APP_HASH, tables: {}, namespaces: {} },
  } as unknown as ReturnType<AggregateContractSpace['contract']>;
  return {
    spaceId: 'app',
    packages: [],
    refs: {},
    headRef: { hash: APP_HASH, invariants: [] },
    graph: () => ({
      nodes: new Set<string>([APP_HASH]),
      forwardChain: new Map(),
      reverseChain: new Map(),
      migrationByHash: new Map(),
    }),
    contract: () => contract,
    contractAt: vi.fn(),
  };
}

function makeAggregate(): ContractSpaceAggregate {
  return createContractSpaceAggregate({
    targetId: 'postgres',
    app: makeAppSpace(),
    extensions: [],
    checkIntegrity: () => [],
  });
}

function makePerSpacePlan(): PerSpacePlan {
  const plan: MigrationPlan = {
    targetId: 'postgres',
    spaceId: 'app',
    origin: null,
    destination: { storageHash: APP_HASH },
    operations: [],
    providedInvariants: [],
  };
  return {
    plan,
    displayOps: [],
    destinationContract: makeAppSpace().contract,
    strategy: 'resolve-recorded-path',
    migrationEdges: [
      buildFabricatedMigrationEdge({
        currentMarkerStorageHash: null,
        destinationStorageHash: APP_HASH,
        operationCount: 0,
      }),
    ],
    pathDecision: undefined,
  } as unknown as PerSpacePlan;
}

async function failureOf(runnerFailure: MigrationRunnerFailure, origin: MigrationPlan['origin']) {
  const failingResult: MigrationRunnerResult = notOk(runnerFailure);
  const migrations = {
    createRunner: () => ({ execute: async () => failingResult }),
  } as unknown as TargetMigrationsCapability<
    'sql',
    'postgres',
    ControlFamilyInstance<'sql', unknown>
  >;
  const perSpacePlan = makePerSpacePlan();
  const result = await runMigration<'sql', 'postgres'>({
    aggregate: makeAggregate(),
    perSpacePlans: new Map([
      [
        'app',
        { ...perSpacePlan, plan: { ...perSpacePlan.plan, origin } } as unknown as PerSpacePlan,
      ],
    ]),
    applyOrder: ['app'],
    driver: {} as ControlDriverInstance<'sql', 'postgres'>,
    familyInstance: { familyId: 'sql' } as unknown as ControlFamilyInstance<'sql', unknown>,
    migrations,
    frameworkComponents: [],
    policy: { allowedOperationClasses: ['additive', 'widening', 'destructive', 'data'] },
    action: 'migrate',
  });
  return result.ok ? undefined : result.failure;
}

const precheckFailed: MigrationRunnerFailure = {
  code: 'MIGRATION.PRECHECK_FAILED',
  summary: 'Operation column.x failed during precheck: ensure column "x" is missing',
  failingSpace: 'app',
  meta: {
    operationId: 'column.x',
    phase: 'precheck',
    stepDescription: 'ensure column "x" is missing',
  },
};

describe('runMigration, a check that failed before an operation', () => {
  it('names the check, and says the space had no marker when its plan starts from none', async () => {
    expect((await failureOf(precheckFailed, null))?.failedPrecheck).toEqual({
      operationId: 'column.x',
      description: 'ensure column "x" is missing',
      databaseHasMarker: false,
    });
  });

  it('says the space had a marker when its plan starts from one', async () => {
    expect(
      (await failureOf(precheckFailed, { storageHash: APP_HASH }))?.failedPrecheck,
    ).toMatchObject({ databaseHasMarker: true });
  });

  it('leaves it out when the runner explained the failure itself', async () => {
    expect(
      (await failureOf({ ...precheckFailed, why: 'Renaming would overwrite values.' }, null))
        ?.failedPrecheck,
    ).toBeUndefined();
  });
});
