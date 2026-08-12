import { describe, expect, it } from 'vitest';
import type { SqlConnection, SqlDriver, SqlExecuteRequest } from '../../src/ast/driver-types';

function createMockDriverWithVoidBinding(): SqlDriver {
  const queryable = {
    execute: async () => ({ affectedRows: 0 }),
    async *query(_request: SqlExecuteRequest) {
      yield { id: 1 };
    },
  };

  const transaction = {
    ...queryable,
    commit: async () => {},
    rollback: async () => {},
  } as unknown as Awaited<ReturnType<SqlConnection['beginTransaction']>>;

  const connection = {
    ...queryable,
    release: async () => {},
    destroy: async (_reason?: unknown) => {},
    beginTransaction: async () => transaction,
  } as unknown as SqlConnection;

  return {
    ...queryable,
    connect: async (_binding?: undefined) => {},
    acquireConnection: async () => connection,
    close: async () => {},
  } as unknown as SqlDriver;
}

describe('SqlDriver', () => {
  describe('connect with TBinding = void', () => {
    it('accepts undefined binding and resolves', async () => {
      const driver = createMockDriverWithVoidBinding();
      await expect(driver.connect(undefined)).resolves.toBeUndefined();
    });
  });
});
