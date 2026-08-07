import type { PlanMeta } from '@internal/contract/types';
import type {
  AfterQueryResult,
  CrossFamilyMiddleware,
  ExecutionPlan,
  QueryPlan,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from '@internal/framework-components/runtime';
import { RuntimeCore } from '@internal/framework-components/runtime';
import type { MongoAdapter, MongoDriver } from '@internal/mongo-lowering';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import {
  createMongoExecutionContext,
  createMongoExecutionStack,
  createMongoRuntime,
  type MongoExecutionContext,
  type MongoRuntimeAdapterDescriptor,
} from '@internal/mongo-runtime';
import mongoRuntimeTarget from '@internal/target-mongo/runtime';
import { describe, expect, it, vi } from 'vitest';

/**
 * Minimal cross-family observer for tests. Records `beforeQuery` and
 * `afterQuery` events into an array; declares no `familyId`/`targetId`
 * so it composes against any runtime that satisfies the framework SPI.
 *
 * This is the structural shape that the (now-retired)
 * `@internal/middleware-telemetry` package shipped as a
 * proof-of-concept; the cross-family contract is now exercised by the
 * real `@internal/middleware-cache` package (see
 * `middleware-cache.test.ts` and `examples/mongo-demo`). The tests in
 * this file remain useful for asserting composition order and the
 * `source: 'driver' | 'middleware'` round-trip without coupling to a
 * specific middleware package.
 */
interface ObservedEvent {
  readonly phase: 'beforeQuery' | 'afterQuery';
  readonly lane: string;
  readonly target: string;
  readonly storageHash: string;
  readonly rowCount?: number;
  readonly completed?: boolean;
  readonly source?: 'driver' | 'middleware';
}

function collectingObserver() {
  const events: ObservedEvent[] = [];
  const middleware: CrossFamilyMiddleware = {
    name: 'observer',
    async beforeQuery(plan: { readonly meta: PlanMeta }, _ctx: RuntimeMiddlewareContext) {
      events.push({
        phase: 'beforeQuery',
        lane: plan.meta.lane,
        target: plan.meta.target,
        storageHash: plan.meta.storageHash,
      });
    },
    async afterQuery(
      plan: { readonly meta: PlanMeta },
      result: AfterQueryResult,
      _ctx: RuntimeMiddlewareContext,
    ) {
      events.push({
        phase: 'afterQuery',
        lane: plan.meta.lane,
        target: plan.meta.target,
        storageHash: plan.meta.storageHash,
        ...(result.operation === 'query' ? { rowCount: result.rowCount } : {}),
        completed: result.completed,
        source: result.source,
      });
    },
  };
  return { middleware, events };
}

interface MockSqlPlan extends QueryPlan {
  readonly sql: string;
  readonly params: readonly unknown[];
}

interface MockSqlExec extends ExecutionPlan {
  readonly sql: string;
  readonly params: readonly unknown[];
}

class MockSqlRuntime extends RuntimeCore<MockSqlPlan, MockSqlExec, RuntimeMiddleware<MockSqlExec>> {
  // Exposed so tests can assert whether the underlying "driver" was hit
  // (e.g. confirming that an `interceptQuery` middleware short-circuited
  // execution). Symmetric with the Mongo mock's `driver.execute` spy.
  readonly driverSpy = vi.fn<(exec: MockSqlExec) => void>();

  constructor(
    middleware: ReadonlyArray<RuntimeMiddleware<MockSqlExec>>,
    ctx: RuntimeMiddlewareContext,
    private readonly rows: ReadonlyArray<Record<string, unknown>>,
  ) {
    super({ middleware, ctx });
  }

  protected lower(plan: MockSqlPlan): MockSqlExec {
    return { sql: plan.sql, params: plan.params, meta: plan.meta };
  }

  protected runDriver(exec: MockSqlExec): AsyncIterable<Record<string, unknown>> {
    this.driverSpy(exec);
    const rows = this.rows;
    return {
      async *[Symbol.asyncIterator](): AsyncIterator<Record<string, unknown>> {
        for (const row of rows) {
          yield row;
        }
      },
    };
  }

  protected runExecute(): Promise<{ affectedRows: number }> {
    return Promise.resolve({ affectedRows: 0 });
  }

  async close(): Promise<void> {}
}

function createMockMongoAdapter(): MongoAdapter {
  // Mirrors the real two-phase adapter: `structuralLower` produces a draft that
  // keeps the command intact, and `resolveParams` turns that draft into the
  // wire command. `lower` is retained as the composed one-shot equivalent.
  const structuralLower = vi.fn((plan: MongoQueryPlan) => ({
    kind: plan.command.kind,
    collection: plan.collection,
    command: plan.command,
  }));
  const resolveParams = vi.fn((draft: { collection: string; command: unknown }) => ({
    collection: draft.collection,
    command: draft.command,
  }));
  return {
    structuralLower,
    resolveParams,
    lower: vi.fn((plan: MongoQueryPlan) => resolveParams(structuralLower(plan))),
  } as unknown as MongoAdapter;
}

// A minimal Mongo runtime adapter descriptor that wraps a caller-supplied
// `MongoAdapter` mock. We compose it through the production
// `createMongoExecutionStack` + `createMongoExecutionContext` path so the
// runtime's expectations on stack/context structure are exercised end-to-end
// even with a stub adapter.
function mockAdapterDescriptor(adapter: MongoAdapter): MongoRuntimeAdapterDescriptor<'mongo'> {
  return {
    kind: 'adapter',
    id: 'mongo',
    familyId: 'mongo',
    targetId: 'mongo',
    version: '0.0.1',
    codecs: () => mongoRuntimeTarget.codecs(),
    create: () => ({
      familyId: 'mongo',
      targetId: 'mongo',
      lower: adapter.lower.bind(adapter),
      structuralLower: adapter.structuralLower.bind(adapter),
      resolveParams: adapter.resolveParams.bind(adapter),
    }),
  };
}

function makeMongoContext(adapter: MongoAdapter): MongoExecutionContext {
  const stack = createMongoExecutionStack({
    target: mongoRuntimeTarget,
    adapter: mockAdapterDescriptor(adapter),
  });
  return createMongoExecutionContext({ contract: {}, stack });
}

function createMockMongoDriver(rows: Record<string, unknown>[] = []): MongoDriver {
  return {
    execute: vi.fn(async function* <Row>() {
      for (const row of rows) {
        yield row as Row;
      }
    }),
    close: vi.fn(async () => {}),
  } as unknown as MongoDriver;
}

const mongoMeta: PlanMeta = {
  target: 'mongo',
  targetFamily: 'mongo',
  storageHash: 'mongo-test',
  lane: 'orm',
};

function createMongoPlan(meta: PlanMeta = mongoMeta): MongoQueryPlan {
  return {
    collection: 'users',
    command: { kind: 'find', filter: {} },
    meta,
  } as unknown as MongoQueryPlan;
}

const sqlCtx: RuntimeMiddlewareContext = {
  contract: {},
  mode: 'strict',
  now: () => Date.now(),
  log: { info: () => {}, warn: () => {}, error: () => {} },
  contentHash: async () => 'mock-hash',
  scope: 'runtime',
  operation: 'query',
  planExecutionId: 'test-fixture-plan-execution-id',
};

describe('cross-family middleware proof', () => {
  it('same middleware observes queries from an SQL runtime', async () => {
    const { middleware, events } = collectingObserver();

    const sqlRuntime = new MockSqlRuntime([middleware], sqlCtx, [{ id: 1, name: 'Alice' }]);

    const sqlPlan: MockSqlPlan = {
      sql: 'SELECT id, name FROM users',
      params: [],
      meta: {
        target: 'postgres',
        storageHash: 'sql-test',
        lane: 'sql',
      },
    };

    for await (const _row of sqlRuntime.query(sqlPlan)) {
      void _row;
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      phase: 'beforeQuery',
      lane: 'sql',
      target: 'postgres',
      storageHash: 'sql-test',
    });
    expect(events[1]).toMatchObject({
      phase: 'afterQuery',
      lane: 'sql',
      target: 'postgres',
      rowCount: 1,
      completed: true,
    });
  });

  it('same middleware observes queries from a Mongo runtime', async () => {
    const { middleware, events } = collectingObserver();

    const mongoAdapter = createMockMongoAdapter();
    const mongoRuntime = createMongoRuntime({
      context: makeMongoContext(mongoAdapter),
      driver: createMockMongoDriver([
        { _id: '1', name: 'Bob' },
        { _id: '2', name: 'Carol' },
      ]),
      middleware: [middleware],
    });

    const plan = createMongoPlan(mongoMeta);

    for await (const _row of mongoRuntime.query(plan)) {
      void _row;
    }

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      phase: 'beforeQuery',
      lane: 'orm',
      target: 'mongo',
      storageHash: 'mongo-test',
    });
    expect(events[1]).toMatchObject({
      phase: 'afterQuery',
      rowCount: 2,
      completed: true,
    });
  });

  it('same middleware instance works across SQL and Mongo runtimes', async () => {
    const { middleware, events } = collectingObserver();

    const sqlRuntime = new MockSqlRuntime([middleware], sqlCtx, [{ id: 1 }]);

    const mongoAdapter = createMockMongoAdapter();
    const mongoRuntime = createMongoRuntime({
      context: makeMongoContext(mongoAdapter),
      driver: createMockMongoDriver([{ _id: '1' }]),
      middleware: [middleware],
    });

    const sqlPlan2: MockSqlPlan = {
      sql: 'SELECT 1',
      params: [],
      meta: {
        target: 'postgres',
        storageHash: 'sql-hash',
        lane: 'sql',
      },
    };

    for await (const _row of sqlRuntime.query(sqlPlan2)) {
      void _row;
    }

    const mongoPlan = createMongoPlan({
      target: 'mongo',
      targetFamily: 'mongo',
      storageHash: 'mongo-hash',
      lane: 'orm',
    });

    for await (const _row of mongoRuntime.query(mongoPlan)) {
      void _row;
    }

    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({ target: 'postgres', lane: 'sql' });
    expect(events[1]).toMatchObject({ target: 'postgres', completed: true });
    expect(events[2]).toMatchObject({ target: 'mongo', lane: 'orm' });
    expect(events[3]).toMatchObject({ target: 'mongo', completed: true });
  });

  it('same interceptQuery middleware short-circuits queries in both SQL and Mongo runtimes', async () => {
    // A generic interceptQueryor with no familyId. The same instance is registered
    // on both runtimes and short-circuits execution in each. Demonstrates
    // that the interceptQuery hook is family-agnostic by construction: both
    // SqlRuntime and MongoRuntimeImpl inherit it from runQueryWithMiddleware
    // via RuntimeCore, so no per-family wiring is needed.
    const { middleware: observer, events } = collectingObserver();

    const interceptQueryCalls: string[] = [];
    const interceptQueryed: CrossFamilyMiddleware = {
      name: 'mock-interceptQueryor',
      async interceptQuery(plan) {
        interceptQueryCalls.push(plan.meta.target);
        return { operation: 'query', rows: [{ interceptQueryed: true }] };
      },
    };

    const sqlDriverRows: Record<string, unknown>[] = [{ id: 'should-not-appear' }];
    const sqlRuntime = new MockSqlRuntime([interceptQueryed, observer], sqlCtx, sqlDriverRows);

    const mongoAdapter = createMockMongoAdapter();
    const mongoDriver = createMockMongoDriver([{ _id: 'should-not-appear' }]);
    const mongoRuntime = createMongoRuntime({
      context: makeMongoContext(mongoAdapter),
      driver: mongoDriver,
      middleware: [interceptQueryed, observer],
    });

    const sqlPlan: MockSqlPlan = {
      sql: 'SELECT 1',
      params: [],
      meta: {
        target: 'postgres',
        storageHash: 'sql-hash',
        lane: 'sql',
      },
    };

    const sqlOut: unknown[] = [];
    for await (const row of sqlRuntime.query(sqlPlan)) {
      sqlOut.push(row);
    }

    const mongoPlan = createMongoPlan({
      target: 'mongo',
      targetFamily: 'mongo',
      storageHash: 'mongo-hash',
      lane: 'orm',
    });

    const mongoOut: unknown[] = [];
    for await (const row of mongoRuntime.query(mongoPlan)) {
      mongoOut.push(row);
    }

    // The same interceptQueryed rows came out of both runtimes.
    expect(sqlOut).toEqual([{ interceptQueryed: true }]);
    expect(mongoOut).toEqual([{ interceptQueryed: true }]);

    // The interceptQueryor was invoked once per family.
    expect(interceptQueryCalls).toEqual(['postgres', 'mongo']);

    // Neither underlying driver was invoked: `interceptQuery` short-circuited
    // execution before lowering on both sides.
    expect(sqlRuntime.driverSpy).not.toHaveBeenCalled();
    expect(mongoDriver.execute).not.toHaveBeenCalled();

    // The observer saw both beforeQuery and afterQuery for each run
    // (beforeQuery fires pre-encode regardless of whether interceptQuery
    // short-circuits the driver path) and saw source: 'middleware' on the
    // afterQuery events.
    expect(events).toHaveLength(4);
    expect(events[0]).toMatchObject({
      phase: 'beforeQuery',
      target: 'postgres',
    });
    expect(events[1]).toMatchObject({
      phase: 'afterQuery',
      target: 'postgres',
      completed: true,
      source: 'middleware',
    });
    expect(events[2]).toMatchObject({
      phase: 'beforeQuery',
      target: 'mongo',
    });
    expect(events[3]).toMatchObject({
      phase: 'afterQuery',
      target: 'mongo',
      completed: true,
      source: 'middleware',
    });
  });
});
