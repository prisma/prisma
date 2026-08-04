import type { Contract } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { createAggregateContractSpace } from '@internal/migration-tools/aggregate';
import { blindCast } from '@internal/utils/casts';
import { createSqlContract } from '@repo/test-utils';
import { describe, expect, it, vi } from 'vitest';
import {
  createPerSpaceVerifier,
  type ExecuteDbVerifyOptions,
} from '../../src/control-api/operations/db-verify';

describe('createPerSpaceVerifier', () => {
  it('passes the resolved contract value to verifySchema, not the contract() thunk', () => {
    const contract = createSqlContract({
      target: 'postgres',
      storage: {
        namespaces: {
          [UNBOUND_NAMESPACE_ID]: {
            id: UNBOUND_NAMESPACE_ID,
            entries: { table: { user: {} } },
          },
        },
      },
    });
    const space = createAggregateContractSpace({
      spaceId: 'app',
      packages: [],
      refs: {},
      headRef: { hash: contract.storage.storageHash, invariants: [] },
      refsDir: '/tmp/refs',
      migrationsDir: '/tmp/migrations',
      resolveContract: () => contract,
      deserializeContract: (json) => json as Contract,
    });

    const verifySchema = vi.fn().mockReturnValue({
      ok: true,
      summary: 'ok',
      contract: { storageHash: contract.storage.storageHash },
      target: { expected: 'postgres' },
      schema: {
        issues: [],
      },
      timings: { total: 0 },
    });

    const verifier = createPerSpaceVerifier(
      blindCast<ExecuteDbVerifyOptions<string, string>, 'minimal verifySchema seam'>({
        skipSchema: false,
        familyInstance: { verifySchema },
        frameworkComponents: [],
      }),
    );

    verifier({}, space, 'strict');

    expect(verifySchema).toHaveBeenCalledOnce();
    const passedContract = verifySchema.mock.calls[0]![0].contract as Contract;
    expect(typeof passedContract).toBe('object');
    expect(passedContract).toBe(contract);
    expect(typeof (space as { contract: unknown }).contract).toBe('function');
    expect(passedContract).not.toBe(space.contract);
  });
});
