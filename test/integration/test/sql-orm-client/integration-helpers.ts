import postgresAdapterControl from '@internal/adapter-postgres/control';
import type { Contract } from '@internal/contract/types';
import postgresDriverControl from '@internal/driver-postgres/control';
import sqlFamilyControl, { INIT_ADDITIVE_POLICY } from '@internal/family-sql/control';
import { APP_SPACE_ID, createControlStack } from '@internal/framework-components/control';
import { buildFabricatedMigrationEdge } from '@internal/migration-tools/aggregate';
import type { SqlStorage } from '@internal/sql-contract/types';
import { Collection } from '@internal/sql-orm-client';
import type { ExecutionContext } from '@internal/sql-relational-core/query-lane-context';
import type { SqlRuntimeExtensionDescriptor } from '@internal/sql-runtime';
import postgresTargetControl from '@internal/target-postgres/control';
import { timeouts, withDevDatabase } from '@repo/test-utils';
import { withReturningCapability } from './collection-fixtures';
import { getTestContext, getTestContract, type TestContract } from './helpers';
import {
  createPgIntegrationRuntime,
  type PgIntegrationRuntime,
  setupTestSchema,
} from './runtime-helpers';

export { timeouts };

const controlStack = createControlStack({
  family: sqlFamilyControl,
  target: postgresTargetControl,
  adapter: postgresAdapterControl,
  driver: postgresDriverControl,
  extensions: [],
});
const controlFamily = sqlFamilyControl.create(controlStack);
const controlAdapter = postgresAdapterControl.create(controlStack);
const frameworkComponents = [
  postgresTargetControl,
  postgresAdapterControl,
  postgresDriverControl,
] as const;

export function createUsersCollection(runtime: PgIntegrationRuntime) {
  return new Collection({ runtime, context: getTestContext() }, 'User', { namespaceId: 'public' });
}

export function createUsersCollectionWithoutReturning(runtime: PgIntegrationRuntime) {
  const contract = { ...getTestContract(), capabilities: {} } as TestContract;
  const context = { ...getTestContext(), contract } as ExecutionContext<TestContract>;
  return new Collection({ runtime, context }, 'User', { namespaceId: 'public' });
}

export function createPostsCollection(runtime: PgIntegrationRuntime) {
  return new Collection({ runtime, context: getTestContext() }, 'Post', { namespaceId: 'public' });
}

// Shallow spread is intentional — withReturningCapability only adds capabilities
// without changing codec structure, so codecs/operations registries remain valid.
export function createReturningUsersCollection(runtime: PgIntegrationRuntime) {
  const contract = withReturningCapability(getTestContract());
  const context = { ...getTestContext(), contract } as ExecutionContext<TestContract>;
  return new Collection({ runtime, context }, 'User', { namespaceId: 'public' });
}

export function createReturningPostsCollection(runtime: PgIntegrationRuntime) {
  const contract = withReturningCapability(getTestContract());
  const context = { ...getTestContext(), contract } as ExecutionContext<TestContract>;
  return new Collection({ runtime, context }, 'Post', { namespaceId: 'public' });
}

export function createReturningTagsCollection(runtime: PgIntegrationRuntime) {
  const contract = withReturningCapability(getTestContract());
  const context = { ...getTestContext(), contract } as ExecutionContext<TestContract>;
  return new Collection({ runtime, context }, 'Tag', { namespaceId: 'public' });
}

export async function withPushedContractRuntime(
  contract: Contract<SqlStorage>,
  fn: (runtime: PgIntegrationRuntime) => Promise<void>,
): Promise<void> {
  await withDevDatabase(
    async ({ connectionString }) => {
      const driver = await postgresDriverControl.create(connectionString);
      try {
        const schema = await controlFamily.introspect({ driver, contract });
        const planner = postgresTargetControl.createPlanner(controlAdapter);
        const planResult = planner.plan({
          contract,
          schema,
          policy: INIT_ADDITIVE_POLICY,
          fromContract: null,
          frameworkComponents,
          spaceId: APP_SPACE_ID,
          snapshotsImportPath: '../../snapshots',
        });
        if (planResult.kind !== 'success') {
          throw new Error(`Contract push planning failed: ${JSON.stringify(planResult)}`);
        }

        const plan = planResult.plan;
        const runner = postgresTargetControl.createRunner(controlFamily);
        const executeResult = await runner.execute({
          driver,
          perSpaceOptions: [
            {
              space: plan.spaceId ?? APP_SPACE_ID,
              plan,
              migrationEdges: [
                buildFabricatedMigrationEdge({
                  currentMarkerStorageHash: plan.origin?.storageHash,
                  destinationStorageHash: plan.destination.storageHash,
                  operationCount: plan.operations.length,
                }),
              ],
              driver,
              destinationContract: contract,
              policy: INIT_ADDITIVE_POLICY,
              frameworkComponents,
            },
          ],
        });
        if (!executeResult.ok) {
          throw new Error(`Contract push apply failed: ${JSON.stringify(executeResult.failure)}`);
        }
      } finally {
        await driver.close();
      }

      const runtime = await createPgIntegrationRuntime(connectionString, contract);
      try {
        await fn(runtime);
      } finally {
        await runtime.close();
      }
    },
    { databaseIdleTimeoutMillis: 30_000 },
  );
}

export async function withCollectionRuntime(
  fn: (runtime: PgIntegrationRuntime) => Promise<void>,
  // Build the runtime against a non-base contract (the emitted polymorphism
  // fixture) when a test drives that contract: the runtime validates each
  // plan's storageHash against the contract it was built with.
  contractOverride?: Contract<SqlStorage>,
  additionalExtensions: readonly SqlRuntimeExtensionDescriptor<'postgres'>[] = [],
): Promise<void> {
  await withDevDatabase(
    async ({ connectionString }) => {
      const runtime = await createPgIntegrationRuntime(
        connectionString,
        contractOverride,
        additionalExtensions,
      );

      try {
        await setupTestSchema(runtime);
        await fn(runtime);
      } finally {
        await runtime.close();
      }
    },
    // The runtime now drives a single long-lived client (so transactions hold one
    // connection on the single-backend PGlite server). The server's default 1s
    // idle timeout reaps that client during brief idle windows under full-suite
    // load — a pool would reconnect, a lone client cannot — so give it generous
    // headroom. No test holds the connection idle anywhere near this long.
    { databaseIdleTimeoutMillis: 30_000 },
  );
}
