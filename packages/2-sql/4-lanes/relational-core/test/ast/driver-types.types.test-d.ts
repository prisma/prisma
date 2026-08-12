import { expectTypeOf, test } from 'vitest';
import type { SqlDriver, SqlExecuteRequest } from '../../src/ast/driver-types';

type PoolBinding = { pool: { connect: () => Promise<unknown> } };
type ClientBinding = { client: { query: (sql: string) => Promise<unknown> } };
type TestBinding = PoolBinding | ClientBinding;

test('SqlDriver interface supports connect(binding: TBinding)', () => {
  expectTypeOf<SqlDriver<TestBinding>>()
    .toHaveProperty('connect')
    .parameter(0)
    .toEqualTypeOf<TestBinding>();
});

test('SqlDriver default TBinding is void', () => {
  expectTypeOf<SqlDriver>().toHaveProperty('connect');
  expectTypeOf<SqlDriver>().toExtend<SqlDriver<void>>();
});

test('mock driver implementing SqlDriver<TestBinding> compiles and accepts binding at connect', () => {
  const queryable = {
    async *execute(_request: SqlExecuteRequest): AsyncIterable<Record<string, unknown>> {
      yield { id: 1 };
    },
    query: async () => ({ rows: [] as ReadonlyArray<Record<string, unknown>>, rowCount: 0 }),
  };

  const driver = {
    ...queryable,
    connect: async (binding: TestBinding) => {
      expectTypeOf(binding).toEqualTypeOf<TestBinding>();
    },
    acquireConnection: async () =>
      ({
        ...queryable,
        release: async () => {},
        destroy: async (_reason?: unknown) => {},
        beginTransaction: async () => ({
          ...queryable,
          commit: async () => {},
          rollback: async () => {},
        }),
      }) as unknown as Awaited<ReturnType<SqlDriver<TestBinding>['acquireConnection']>>,
    close: async () => {},
  } as unknown as SqlDriver<TestBinding>;

  expectTypeOf(driver.connect).toBeFunction();
  expectTypeOf(driver.connect).parameter(0).toEqualTypeOf<TestBinding>();
});
