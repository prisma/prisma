/**
 * Shared test utilities for PostgreSQL adapter tests.
 *
 * These utilities provide factory functions for creating test contracts,
 * schemas, and other common test fixtures.
 */

import type { Contract } from '@prisma-next/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@prisma-next/framework-components/ir';
import { SqlStorage, type StorageTableInput } from '@prisma-next/sql-contract/types';
import { postgresCreateNamespace } from '@prisma-next/target-postgres/types';
import { createContract } from '@repo/test-utils';

export function createTestContract(
  overrides: { tables?: Record<string, StorageTableInput>; storageHash?: string } = {},
): Contract<SqlStorage> {
  const unboundNs = postgresCreateNamespace({
    id: UNBOUND_NAMESPACE_ID,
    entries: { table: overrides.tables ?? {} },
  });
  return createContract<SqlStorage>({
    storage: new SqlStorage({
      storageHash: (overrides.storageHash ?? 'test') as never,
      namespaces: { [UNBOUND_NAMESPACE_ID]: unboundNs },
    }),
  });
}
