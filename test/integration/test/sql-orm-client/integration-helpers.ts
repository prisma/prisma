import type { Contract } from '@prisma-next/contract/types';
import type { SqlStorage } from '@prisma-next/sql-contract/types';
import { Collection } from '@prisma-next/sql-orm-client';
import type { ExecutionContext } from '@prisma-next/sql-relational-core/query-lane-context';
import type { SqlRuntimeExtensionDescriptor } from '@prisma-next/sql-runtime';
import { timeouts, withDevDatabase } from '@repo/test-utils';
import { withReturningCapability } from './collection-fixtures';
import { getTestContext, getTestContract, type TestContract } from './helpers';
import {
  createPgIntegrationRuntime,
  type PgIntegrationRuntime,
  setupTestSchema,
} from './runtime-helpers';

export { timeouts };

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
