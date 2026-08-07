import type {
  ControlDriverInstance,
  ControlFamilyInstance,
  MigrationPlan,
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
import { notOk, ok } from '@internal/utils/result';
import { describe, expect, it, vi } from 'vitest';
import { type RunAction, runMigration } from '../../src/control-api/operations/run-migration';
import type { ControlProgressEvent } from '../../src/control-api/types';

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

function makeMigrations(): TargetMigrationsCapability<
  'sql',
  'postgres',
  ControlFamilyInstance<'sql', unknown>
> {
  const runnerResult: MigrationRunnerResult = ok({
    perSpaceResults: [{ space: 'app', value: { operationsPlanned: 0, operationsExecuted: 0 } }],
  });
  return {
    createRunner: () => ({
      execute: async () => runnerResult,
    }),
  } as unknown as TargetMigrationsCapability<
    'sql',
    'postgres',
    ControlFamilyInstance<'sql', unknown>
  >;
}

async function runWithAction(action: RunAction): Promise<ControlProgressEvent[]> {
  const events: ControlProgressEvent[] = [];
  const aggregate = makeAggregate();
  const perSpacePlans = new Map([['app', makePerSpacePlan()]]);

  await runMigration<'sql', 'postgres'>({
    aggregate,
    perSpacePlans,
    applyOrder: ['app'],
    driver: {} as ControlDriverInstance<'sql', 'postgres'>,
    familyInstance: { familyId: 'sql' } as unknown as ControlFamilyInstance<'sql', unknown>,
    migrations: makeMigrations(),
    frameworkComponents: [],
    policy: { allowedOperationClasses: ['additive', 'widening', 'destructive', 'data'] },
    action,
    onProgress: (event) => events.push(event),
  });
  return events;
}

describe('runMigration apply span label', () => {
  it('emits the `dbInit` label for action=dbInit', async () => {
    const events = await runWithAction('dbInit');
    const start = events.find((e) => e.kind === 'spanStart' && e.spanId === 'apply');
    expect(start).toMatchObject({
      action: 'dbInit',
      label: 'Initialising database across spaces',
    });
  });

  it('emits the `dbUpdate` label for action=dbUpdate', async () => {
    const events = await runWithAction('dbUpdate');
    const start = events.find((e) => e.kind === 'spanStart' && e.spanId === 'apply');
    expect(start).toMatchObject({
      action: 'dbUpdate',
      label: 'Updating database across spaces',
    });
  });

  it('emits the `migrate` label for action=migrate', async () => {
    const events = await runWithAction('migrate');
    const start = events.find((e) => e.kind === 'spanStart' && e.spanId === 'apply');
    expect(start).toMatchObject({
      action: 'migrate',
      label: 'Running migration plan across spaces',
    });
  });
});

describe('runMigration runner-failure cause forwarding', () => {
  it('preserves the runner failure object as `cause` on the RunnerFailure', async () => {
    const runnerFailure = {
      code: 'MIGRATION.APPLY_FAILED',
      summary: 'relation "users" already exists',
      why: 'CREATE TABLE users conflicted with an existing relation',
      meta: { sqlState: '42P07' },
      failingSpace: 'app',
    };
    const failingResult: MigrationRunnerResult = notOk(runnerFailure);
    const migrations = {
      createRunner: () => ({
        execute: async () => failingResult,
      }),
    } as unknown as TargetMigrationsCapability<
      'sql',
      'postgres',
      ControlFamilyInstance<'sql', unknown>
    >;

    const result = await runMigration<'sql', 'postgres'>({
      aggregate: makeAggregate(),
      perSpacePlans: new Map([['app', makePerSpacePlan()]]),
      applyOrder: ['app'],
      driver: {} as ControlDriverInstance<'sql', 'postgres'>,
      familyInstance: { familyId: 'sql' } as unknown as ControlFamilyInstance<'sql', unknown>,
      migrations,
      frameworkComponents: [],
      policy: { allowedOperationClasses: ['additive', 'widening', 'destructive', 'data'] },
      action: 'migrate',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.cause).toBe(runnerFailure);
    expect(result.failure.meta).toMatchObject({
      failingSpace: 'app',
      runnerErrorCode: 'MIGRATION.APPLY_FAILED',
      sqlState: '42P07',
    });
  });
});
