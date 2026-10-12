import type { PlanMeta } from '@internal/contract/types';
import type { CodecCallContext } from '@internal/framework-components/codec';
import { type MongoCodecRegistry, newMongoCodecRegistry } from '@internal/mongo-codec';
import type { MongoAdapter, MongoDriver, MongoLoweredDraft } from '@internal/mongo-lowering';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';
import {
  AggregateWireCommand,
  type AnyMongoDmlWireCommand,
  DeleteManyWireCommand,
  DeleteOneWireCommand,
  UpdateManyWireCommand,
  UpdateOneWireCommand,
} from '@internal/mongo-wire';
import { describe, expect, it, vi } from 'vitest';
import type {
  MongoExecutionContext,
  MongoExecutionStack,
  MongoRuntimeAdapterDescriptor,
  MongoRuntimeAdapterInstance,
  MongoRuntimeTargetDescriptor,
} from '../src/mongo-execution-stack';
import type { MongoMiddleware, MongoMiddlewareContext } from '../src/mongo-middleware';
import { createMongoRuntime } from '../src/mongo-runtime';

function makeContext(
  _adapter: MongoAdapter,
  wireCommand: AnyMongoDmlWireCommand = new AggregateWireCommand('users', []),
): MongoExecutionContext {
  const codecs: MongoCodecRegistry = newMongoCodecRegistry();
  const adapterInstance: MongoRuntimeAdapterInstance<'mongo'> = {
    familyId: 'mongo',
    targetId: 'mongo',
    lower: vi.fn(
      async () => wireCommand,
    ) as unknown as MongoRuntimeAdapterInstance<'mongo'>['lower'],
    structuralLower: vi.fn(
      (plan: MongoQueryPlan): MongoLoweredDraft => ({
        kind: 'rawAggregate',
        collection: plan.collection,
        pipeline: [],
      }),
    ),
    resolveParams: vi.fn(async (_draft: MongoLoweredDraft, _ctx: CodecCallContext) => wireCommand),
  };
  const target: MongoRuntimeTargetDescriptor<'mongo'> = {
    kind: 'target',
    id: 'mongo',
    familyId: 'mongo',
    targetId: 'mongo',
    version: '0.0.1',
    codecs: () => newMongoCodecRegistry(),
    create: () => ({ familyId: 'mongo', targetId: 'mongo' }),
  };
  const adapterDescriptor: MongoRuntimeAdapterDescriptor<'mongo'> = {
    kind: 'adapter',
    id: 'mongo',
    familyId: 'mongo',
    targetId: 'mongo',
    version: '0.0.1',
    codecs: () => newMongoCodecRegistry(),
    create: () => adapterInstance,
  };
  const stack: MongoExecutionStack<'mongo'> = {
    target,
    adapter: adapterDescriptor,
    driver: undefined,
    extensions: [],
  };
  return Object.freeze({ contract: {}, codecs, stack, applyMutationDefaults: () => [] });
}

const baseMeta: PlanMeta = {
  target: 'mongo',
  targetFamily: 'mongo',
  storageHash: 'test',
  lane: 'orm',
};

function createPlan(overrides?: Partial<MongoQueryPlan>): MongoQueryPlan {
  return {
    collection: 'users',
    command: { kind: 'find', filter: {} },
    meta: baseMeta,
    ...overrides,
  } as MongoQueryPlan;
}

function createMockAdapter(): MongoAdapter {
  return {
    lower: vi.fn((plan: MongoQueryPlan) => ({
      collection: plan.collection,
      command: plan.command,
    })),
  } as unknown as MongoAdapter;
}

function createMockDriver(rows: Record<string, unknown>[] = []): MongoDriver {
  return {
    execute: vi.fn(async function* <Row>() {
      for (const row of rows) {
        yield row as Row;
      }
    }),
    close: vi.fn(async () => {}),
  } as unknown as MongoDriver;
}

describe('MongoRuntime middleware lifecycle', () => {
  it('calls activityStarted, beforeEncode, onQuery, onRow, activityEnded, activityFinalized in order', async () => {
    const callOrder: string[] = [];
    const middleware: MongoMiddleware = {
      name: 'test',
      async activityStarted() {
        callOrder.push('activityStarted');
      },
      async beforeEncode() {
        callOrder.push('beforeEncode');
      },
      intercept: {
        async onQuery() {
          callOrder.push('onQuery');
          return undefined;
        },
      },
      async onRow() {
        callOrder.push('onRow');
      },
      async activityEnded() {
        callOrder.push('activityEnded');
      },
      async activityFinalized(_activity, result) {
        callOrder.push(`activityFinalized:${result.outcome}`);
      },
    };

    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: createMockDriver([{ _id: '1', name: 'Alice' }]),
      middleware: [middleware],
    });

    const plan = createPlan();
    for await (const _row of runtime.query(plan)) {
      void _row;
    }

    expect(callOrder).toEqual([
      'activityStarted',
      'beforeEncode',
      'onQuery',
      'onRow',
      'activityEnded',
      'activityFinalized:committed',
    ]);
  });

  it('works with no middleware', async () => {
    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: createMockDriver([{ _id: '1' }]),
    });

    const results: unknown[] = [];
    for await (const row of runtime.query(createPlan())) {
      results.push(row);
    }

    expect(results).toHaveLength(1);
  });

  it('intercepts execute statistics through intercept.onExecute only', async () => {
    const calls: string[] = [];
    const contexts: MongoMiddlewareContext[] = [];
    const driver = createMockDriver([{ deletedCount: 99 }]);
    const context = makeContext(createMockAdapter(), new DeleteOneWireCommand('users', { id: 1 }));
    const runtime = createMongoRuntime({
      context,
      driver,
      middleware: [
        {
          name: 'query-only',
          intercept: {
            async onQuery() {
              calls.push('onQuery');
              return undefined;
            },
          },
        },
        {
          name: 'passthrough',
          async beforeEncode(_plan, ctx) {
            calls.push('beforeEncode');
            contexts.push(ctx);
          },
          intercept: {
            async onExecute(_plan, ctx) {
              calls.push('passthrough');
              contexts.push(ctx);
              return undefined;
            },
          },
          async activityEnded(_activity, result, ctx) {
            calls.push(
              `ended:${result.kind === 'statement' && result.returns === 'stats' ? result.stats?.affectedRows : 'rows'}`,
            );
            contexts.push(ctx);
          },
        },
        {
          name: 'winner',
          intercept: {
            async onExecute(_plan, ctx) {
              calls.push('winner');
              contexts.push(ctx);
              return { stats: { affectedRows: 5 } };
            },
          },
        },
        {
          name: 'tail',
          intercept: {
            async onExecute() {
              calls.push('tail');
              return { stats: { affectedRows: 6 } };
            },
          },
        },
      ],
    });

    await expect(runtime.execute(createPlan())).resolves.toEqual({ affectedRows: 5 });
    expect(driver.execute).not.toHaveBeenCalled();
    expect(calls).toEqual(['beforeEncode', 'passthrough', 'winner', 'ended:5']);
    expect(contexts).toHaveLength(4);
    expect(contexts.every((ctx) => ctx === contexts[0])).toBe(true);
    expect(contexts[0]?.contract).toBe(context.contract);
    expect(contexts[0]?.scope).toBe('runtime');
    expect(contexts[0]?.parent).toBeUndefined();
  });

  it('maps updateOne modifiedCount to affectedRows', async () => {
    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(
        adapter,
        new UpdateOneWireCommand('users', { id: 1 }, { $set: { active: true } }),
      ),
      driver: createMockDriver([{ matchedCount: 1, modifiedCount: 1 }]),
    });

    await expect(runtime.execute(createPlan())).resolves.toEqual({ affectedRows: 1 });
  });

  it('maps update modifiedCount to affectedRows', async () => {
    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(
        adapter,
        new UpdateManyWireCommand('users', {}, { $set: { active: true } }),
      ),
      driver: createMockDriver([{ matchedCount: 6, modifiedCount: 4 }]),
    });

    await expect(runtime.execute(createPlan())).resolves.toEqual({ affectedRows: 4 });
  });

  it('maps deleteOne deletedCount to affectedRows', async () => {
    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter, new DeleteOneWireCommand('users', { id: 1 })),
      driver: createMockDriver([{ deletedCount: 1 }]),
    });

    await expect(runtime.execute(createPlan())).resolves.toEqual({ affectedRows: 1 });
  });

  it('maps delete deletedCount to affectedRows', async () => {
    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter, new DeleteManyWireCommand('users', {})),
      driver: createMockDriver([{ deletedCount: 3 }]),
    });

    await expect(runtime.execute(createPlan())).resolves.toEqual({ affectedRows: 3 });
  });

  it('rejects unsupported statistics commands without a default count', async () => {
    const adapter = createMockAdapter();
    const driver = createMockDriver([{ count: 5 }]);
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver,
    });

    await expect(runtime.execute(createPlan())).rejects.toMatchObject({
      code: 'RUNTIME.MONGO_STATISTICS_UNSUPPORTED',
    });
  });

  it('rejects zero statistics results', async () => {
    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter, new DeleteOneWireCommand('users', { id: 1 })),
      driver: createMockDriver([]),
    });

    await expect(runtime.execute(createPlan())).rejects.toMatchObject({
      code: 'RUNTIME.MONGO_STATISTICS_RESULT_INVALID',
    });
  });

  it('rejects multiple statistics results', async () => {
    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(
        adapter,
        new UpdateOneWireCommand('users', { id: 1 }, { $set: { active: true } }),
      ),
      driver: createMockDriver([{ modifiedCount: 1 }, { modifiedCount: 2 }]),
    });

    await expect(runtime.execute(createPlan())).rejects.toMatchObject({
      code: 'RUNTIME.MONGO_STATISTICS_RESULT_INVALID',
    });
  });

  it('rejects update statistics without modifiedCount', async () => {
    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(
        adapter,
        new UpdateManyWireCommand('users', {}, { $set: { active: true } }),
      ),
      driver: createMockDriver([{ matchedCount: 2 }]),
    });

    await expect(runtime.execute(createPlan())).rejects.toMatchObject({
      code: 'RUNTIME.MONGO_STATISTICS_RESULT_INVALID',
    });
  });

  it('passes plan metadata to middleware hooks', async () => {
    const receivedMeta: PlanMeta[] = [];
    const middleware: MongoMiddleware = {
      name: 'meta-inspector',
      async beforeEncode(plan) {
        receivedMeta.push(plan.meta);
      },
    };

    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: createMockDriver([]),
      middleware: [middleware],
    });

    const plan = createPlan();
    for await (const _row of runtime.query(plan)) {
      void _row;
    }

    expect(receivedMeta).toHaveLength(1);
    expect(receivedMeta[0]!.target).toBe('mongo');
    expect(receivedMeta[0]!.lane).toBe('orm');
  });

  it('ends the statement failed on error, then rethrows', async () => {
    const failingDriver = {
      execute: vi.fn(async function* () {
        yield* []; // satisfy generator contract before throwing
        throw new Error('driver failure');
      }),
      close: vi.fn(async () => {}),
    } as unknown as MongoDriver;

    let afterResult: { outcome: string; rowCount: number } | undefined;
    const middleware: MongoMiddleware = {
      name: 'error-observer',
      async activityEnded(_activity, result) {
        if (result.kind === 'statement' && result.returns === 'rows') {
          afterResult = { outcome: result.outcome, rowCount: result.rowCount };
        }
      },
    };

    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: failingDriver,
      middleware: [middleware],
    });

    await expect(async () => {
      for await (const _row of runtime.query(createPlan())) {
        void _row;
      }
    }).rejects.toThrow('driver failure');

    expect(afterResult).toEqual({ outcome: 'failed', rowCount: 0 });
  });

  it('handles error path with middleware that has no activityEnded', async () => {
    const failingDriver = {
      execute: vi.fn(async function* () {
        yield* [];
        throw new Error('driver failure');
      }),
      close: vi.fn(async () => {}),
    } as unknown as MongoDriver;

    const beforeCalled = vi.fn();
    const middleware: MongoMiddleware = {
      name: 'no-activityEnded',
      async beforeEncode() {
        beforeCalled();
      },
    };

    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: failingDriver,
      middleware: [middleware],
    });

    await expect(async () => {
      for await (const _row of runtime.query(createPlan())) {
        void _row;
      }
    }).rejects.toThrow('driver failure');

    expect(beforeCalled).toHaveBeenCalledOnce();
  });

  it('swallows activityEnded errors during error handling and rethrows the original', async () => {
    const failingDriver = {
      execute: vi.fn(async function* () {
        yield* [];
        throw new Error('driver failure');
      }),
      close: vi.fn(async () => {}),
    } as unknown as MongoDriver;

    const middleware: MongoMiddleware = {
      name: 'failing-activityEnded',
      async activityEnded() {
        throw new Error('activityEnded also fails');
      },
    };

    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: failingDriver,
      middleware: [middleware],
    });

    await expect(async () => {
      for await (const _row of runtime.query(createPlan())) {
        void _row;
      }
    }).rejects.toThrow('driver failure');
  });

  it('reports the row count and a succeeded outcome on success', async () => {
    let afterResult: { outcome: string; rowCount: number } | undefined;
    const middleware: MongoMiddleware = {
      name: 'result-observer',
      async activityEnded(_activity, result) {
        if (result.kind === 'statement' && result.returns === 'rows') {
          afterResult = { outcome: result.outcome, rowCount: result.rowCount };
        }
      },
    };

    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: createMockDriver([{ _id: '1' }, { _id: '2' }, { _id: '3' }]),
      middleware: [middleware],
    });

    for await (const _row of runtime.query(createPlan())) {
      void _row;
    }

    expect(afterResult).toEqual({ outcome: 'succeeded', rowCount: 3 });
  });

  it('passes mode through to middleware context', async () => {
    let receivedMode: string | undefined;
    const middleware: MongoMiddleware = {
      name: 'mode-inspector',
      async beforeEncode(_plan, ctx) {
        receivedMode = ctx.mode;
      },
    };

    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: createMockDriver([]),
      middleware: [middleware],
      mode: 'permissive',
    });

    for await (const _row of runtime.query(createPlan())) {
      void _row;
    }

    expect(receivedMode).toBe('permissive');
  });

  it('provides working log and now on the middleware context', async () => {
    let logWorks = false;
    const middleware: MongoMiddleware = {
      name: 'ctx-tester',
      async beforeEncode(_plan, ctx) {
        ctx.log.info('test');
        ctx.log.warn('test');
        ctx.log.error('test');
        ctx.now();
        logWorks = true;
      },
    };

    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: createMockDriver([]),
      middleware: [middleware],
    });

    for await (const _row of runtime.query(createPlan())) {
      void _row;
    }

    expect(logWorks).toBe(true);
  });

  it('exposes a working contentHash on the middleware context over the resolved plan', async () => {
    const observedKeys: string[] = [];
    const middleware: MongoMiddleware = {
      name: 'content-hash-tester',
      intercept: {
        async onQuery(plan, ctx) {
          observedKeys.push(await ctx.contentHash(plan));
          return undefined;
        },
      },
    };

    const adapter = createMockAdapter();
    const runtime = createMongoRuntime({
      context: makeContext(adapter),
      driver: createMockDriver([{ _id: '1' }, { _id: '2' }, { _id: '3' }]),
      middleware: [middleware],
    });

    for await (const _row of runtime.query(createPlan())) {
      void _row;
    }
    for await (const _row of runtime.query(createPlan())) {
      void _row;
    }

    expect(observedKeys).toHaveLength(2);
    expect(observedKeys[0]).toMatch(/^sha512:[0-9a-f]{128}$/);
    expect(observedKeys[0]).toBe(observedKeys[1]);
  });
});

describe('MongoRuntime statement activity identity', () => {
  interface Observation {
    readonly hook: 'activityStarted' | 'beforeEncode' | 'activityEnded';
    readonly id: string | undefined;
    readonly ctx: MongoMiddlewareContext;
  }

  function observerMiddleware(log: Observation[]): MongoMiddleware {
    return {
      name: 'observer',
      async activityStarted(activity, ctx) {
        log.push({ hook: 'activityStarted', id: activity.id, ctx });
      },
      async beforeEncode(_plan, ctx) {
        log.push({ hook: 'beforeEncode', id: undefined, ctx });
      },
      async activityEnded(activity, _result, ctx) {
        log.push({ hook: 'activityEnded', id: activity.id, ctx });
      },
    };
  }

  it('gives every hook of one query the same activity id and context', async () => {
    const log: Observation[] = [];
    const runtime = createMongoRuntime({
      context: makeContext(createMockAdapter()),
      driver: createMockDriver([{ _id: '1' }]),
      middleware: [observerMiddleware(log)],
    });

    for await (const _row of runtime.query(createPlan())) {
      void _row;
    }

    expect(log.map((o) => o.hook)).toEqual(['activityStarted', 'beforeEncode', 'activityEnded']);
    expect(log[0]?.id).toBeTypeOf('string');
    expect(log[0]?.id).toBe(log[2]?.id);
    expect(new Set(log.map((o) => o.ctx)).size).toBe(1);
  });

  it('gives two queries of the same plan instance distinct activities', async () => {
    const log: Observation[] = [];
    const runtime = createMongoRuntime({
      context: makeContext(createMockAdapter()),
      driver: createMockDriver([{ _id: '1' }]),
      middleware: [observerMiddleware(log)],
    });

    const plan = createPlan();
    for await (const _row of runtime.query(plan)) {
      void _row;
    }
    for await (const _row of runtime.query(plan)) {
      void _row;
    }

    expect(log).toHaveLength(6);
    expect(log[0]?.id).toBe(log[2]?.id);
    expect(log[3]?.id).toBe(log[5]?.id);
    expect(log[0]?.id).not.toBe(log[3]?.id);
    expect(log[0]?.ctx).not.toBe(log[3]?.ctx);
  });
});

describe('MongoRuntime middleware compatibility validation', () => {
  it('accepts a generic middleware (no familyId)', () => {
    const middleware: MongoMiddleware = { name: 'generic' };
    expect(() =>
      createMongoRuntime({
        context: makeContext(createMockAdapter()),
        driver: createMockDriver(),
        middleware: [middleware],
      }),
    ).not.toThrow();
  });

  it('accepts a mongo middleware', () => {
    const middleware: MongoMiddleware = { name: 'mongo-specific', familyId: 'mongo' };
    expect(() =>
      createMongoRuntime({
        context: makeContext(createMockAdapter()),
        driver: createMockDriver(),
        middleware: [middleware],
      }),
    ).not.toThrow();
  });

  it('rejects a SQL middleware with a clear error', () => {
    // Intentionally misconfigured to verify the runtime rejects mismatched familyId. The static type narrows familyId to 'mongo' | undefined, so we cast to bypass the type check and exercise the runtime path.
    const middleware = {
      name: 'sql-lints',
      familyId: 'sql' as const,
    } as unknown as MongoMiddleware;
    expect(() =>
      createMongoRuntime({
        context: makeContext(createMockAdapter()),
        driver: createMockDriver(),
        middleware: [middleware],
      }),
    ).toThrow(
      "Middleware 'sql-lints' requires family 'sql' but the runtime is configured for family 'mongo'",
    );
  });
});
