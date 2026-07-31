import type { PlanMeta } from '@internal/contract/types';
import type {
  AfterExecuteResult,
  ExecutionPlan,
  RuntimeMiddlewareContext,
} from '@internal/framework-components/runtime';
import { describe, expect, it, vi } from 'vitest';
import { cacheAnnotation } from '../src/cache-annotation';
import { createCacheMiddleware } from '../src/cache-middleware';
import { type CachedEntry, type CacheStore, createInMemoryCacheStore } from '../src/cache-store';

interface MockExec extends ExecutionPlan {
  readonly statement: string;
}

const baseMeta: PlanMeta = {
  target: 'postgres',
  targetFamily: 'sql',
  storageHash: 'test',
  lane: 'orm',
};

function makeExec(statement: string, annotations?: Record<string, unknown>): MockExec {
  return Object.freeze({
    statement,
    meta: annotations ? { ...baseMeta, annotations } : baseMeta,
  });
}

function makeCtx(overrides?: Partial<RuntimeMiddlewareContext>): RuntimeMiddlewareContext {
  return {
    contract: {},
    mode: 'strict',
    now: () => Date.now(),
    log: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    contentHash: async (exec) => `key:${(exec as MockExec).statement}`,
    scope: 'runtime',
    planExecutionId: 'test-fixture-plan-execution-id',
    ...overrides,
  };
}

function spyStore(): CacheStore & {
  readonly getSpy: ReturnType<typeof vi.fn>;
  readonly setSpy: ReturnType<typeof vi.fn>;
  readonly inner: Map<string, CachedEntry>;
} {
  const inner = new Map<string, CachedEntry>();
  const getSpy = vi.fn(async (key: string) => inner.get(key));
  const setSpy = vi.fn(async (key: string, entry: CachedEntry, _ttlMs: number) => {
    inner.set(key, entry);
  });
  return {
    get: getSpy,
    set: setSpy,
    getSpy,
    setSpy,
    inner,
  };
}

async function drain<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of iter) out.push(x);
  return out;
}

describe('createCacheMiddleware — opt-in semantics', () => {
  it('passes through (no store interaction) when the plan has no cache annotation', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1'); // no annotations

    const result = await mw.intercept!(exec, makeCtx());
    expect(result).toBeUndefined();
    expect(store.getSpy).not.toHaveBeenCalled();
    expect(store.setSpy).not.toHaveBeenCalled();
  });

  it('passes through when the cache annotation has skip: true', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000, skip: true }),
    });

    const result = await mw.intercept!(exec, makeCtx());
    expect(result).toBeUndefined();
    expect(store.getSpy).not.toHaveBeenCalled();
    expect(store.setSpy).not.toHaveBeenCalled();
  });

  it('passes through when no ttl is supplied (presence alone is not sufficient)', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({}),
    });

    const result = await mw.intercept!(exec, makeCtx());
    expect(result).toBeUndefined();
    expect(store.getSpy).not.toHaveBeenCalled();
    expect(store.setSpy).not.toHaveBeenCalled();
  });

  it('does not store rows for an un-annotated plan even when onRow/afterExecute fire (driver path)', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1');
    const ctx = makeCtx();

    await mw.intercept!(exec, ctx); // passthrough
    await mw.onRow!({ id: 1 }, exec, ctx);
    await mw.afterExecute!(
      exec,
      { rowCount: 1, latencyMs: 0, completed: true, source: 'driver' },
      ctx,
    );

    expect(store.setSpy).not.toHaveBeenCalled();
  });
});

describe('createCacheMiddleware — hit path', () => {
  it('returns cached rows from intercept when the store has a non-expired entry', async () => {
    const store = spyStore();
    store.inner.set('key:select 1', {
      rows: [{ id: 1 }, { id: 2 }],
      storedAt: 0,
    });

    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });

    const result = await mw.intercept!(exec, makeCtx());
    expect(result).toBeDefined();
    expect(await drain(result!.rows as AsyncIterable<Record<string, unknown>>)).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it('logs a middleware.cache.hit event via ctx.log.debug on a hit', async () => {
    const store = spyStore();
    store.inner.set('key:select 1', { rows: [{ id: 1 }], storedAt: 0 });
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const debug = vi.fn();
    const ctx = makeCtx({
      log: { info: () => {}, warn: () => {}, error: () => {}, debug },
    });

    await mw.intercept!(exec, ctx);

    expect(debug).toHaveBeenCalledWith(expect.objectContaining({ event: 'middleware.cache.hit' }));
  });

  it('does not call store.set on the hit path', async () => {
    const store = spyStore();
    store.inner.set('key:select 1', { rows: [{ id: 1 }], storedAt: 0 });
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx();

    const result = await mw.intercept!(exec, ctx);
    await drain(result!.rows as AsyncIterable<Record<string, unknown>>);

    // afterExecute fires with source: 'middleware' on a hit; the cache
    // middleware should not write back to the store.
    await mw.afterExecute!(
      exec,
      { rowCount: 1, latencyMs: 0, completed: true, source: 'middleware' },
      ctx,
    );

    expect(store.setSpy).not.toHaveBeenCalled();
  });

  it('survives the absence of ctx.log.debug (it is optional on RuntimeLog)', async () => {
    const store = spyStore();
    store.inner.set('key:select 1', { rows: [{ id: 1 }], storedAt: 0 });
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx({
      // No debug field.
      log: { info: () => {}, warn: () => {}, error: () => {} },
    });

    await expect(mw.intercept!(exec, ctx)).resolves.toBeDefined();
  });
});

describe('createCacheMiddleware — miss path', () => {
  it('returns undefined from intercept on a miss', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });

    const result = await mw.intercept!(exec, makeCtx());
    expect(result).toBeUndefined();
  });

  it('logs a middleware.cache.miss event via ctx.log.debug on a miss', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const debug = vi.fn();
    const ctx = makeCtx({
      log: { info: () => {}, warn: () => {}, error: () => {}, debug },
    });

    await mw.intercept!(exec, ctx);

    expect(debug).toHaveBeenCalledWith(expect.objectContaining({ event: 'middleware.cache.miss' }));
  });

  it('buffers rows via onRow and commits on a successful afterExecute (source: driver)', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store, clock: () => 1_234 });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx();

    await mw.intercept!(exec, ctx); // miss
    await mw.onRow!({ id: 1 }, exec, ctx);
    await mw.onRow!({ id: 2 }, exec, ctx);
    await mw.afterExecute!(
      exec,
      { rowCount: 2, latencyMs: 5, completed: true, source: 'driver' },
      ctx,
    );

    expect(store.setSpy).toHaveBeenCalledTimes(1);
    expect(store.setSpy).toHaveBeenCalledWith(
      'key:select 1',
      expect.objectContaining({
        rows: [{ id: 1 }, { id: 2 }],
        storedAt: 1_234,
      }),
      60_000,
    );
  });

  it('does not commit when completed = false (driver threw mid-stream)', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx();

    await mw.intercept!(exec, ctx);
    await mw.onRow!({ id: 1 }, exec, ctx);
    await mw.afterExecute!(
      exec,
      { rowCount: 1, latencyMs: 5, completed: false, source: 'driver' },
      ctx,
    );

    expect(store.setSpy).not.toHaveBeenCalled();
  });

  it('does not commit when source = "middleware" (a different interceptor produced the rows)', async () => {
    // If another middleware wins the intercept chain, our intercept did
    // not fire — we never called set up a buffer. afterExecute would see
    // source === 'middleware' and we should not store anything.
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx();

    // Note: skipping intercept and onRow simulates the case where a
    // different interceptor short-circuited execution upstream.
    await mw.afterExecute!(
      exec,
      { rowCount: 1, latencyMs: 5, completed: true, source: 'middleware' },
      ctx,
    );

    expect(store.setSpy).not.toHaveBeenCalled();
  });

  it('cleans up its WeakMap entry on afterExecute even when no commit happens', async () => {
    // The buffer is a WeakMap keyed on the exec object — testing this
    // directly would be brittle; instead, verify behavior: re-running
    // afterExecute without an intercept call should be a no-op even if
    // the previous run did not commit.
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx();

    await mw.intercept!(exec, ctx);
    await mw.onRow!({ id: 1 }, exec, ctx);
    // Mid-stream failure.
    await mw.afterExecute!(
      exec,
      { rowCount: 1, latencyMs: 5, completed: false, source: 'driver' },
      ctx,
    );

    // A second afterExecute (defensive — should never happen in
    // practice, but verify cleanup didn't leave residue).
    await mw.afterExecute!(
      exec,
      { rowCount: 1, latencyMs: 5, completed: true, source: 'driver' },
      ctx,
    );

    expect(store.setSpy).not.toHaveBeenCalled();
  });

  it('keeps per-execution buffers isolated across two concurrent execs', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store, clock: () => 0 });
    const execA = makeExec('select A', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const execB = makeExec('select B', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx();

    // Interleave the two executions to stress per-exec buffer isolation.
    await mw.intercept!(execA, ctx);
    await mw.intercept!(execB, ctx);
    await mw.onRow!({ from: 'A', n: 1 }, execA, ctx);
    await mw.onRow!({ from: 'B', n: 1 }, execB, ctx);
    await mw.onRow!({ from: 'A', n: 2 }, execA, ctx);
    await mw.onRow!({ from: 'B', n: 2 }, execB, ctx);

    const result: AfterExecuteResult = {
      rowCount: 2,
      latencyMs: 0,
      completed: true,
      source: 'driver',
    };
    await mw.afterExecute!(execA, result, ctx);
    await mw.afterExecute!(execB, result, ctx);

    expect(store.inner.get('key:select A')?.rows).toEqual([
      { from: 'A', n: 1 },
      { from: 'A', n: 2 },
    ]);
    expect(store.inner.get('key:select B')?.rows).toEqual([
      { from: 'B', n: 1 },
      { from: 'B', n: 2 },
    ]);
  });
});

describe('createCacheMiddleware — scope guard', () => {
  it('passes through when ctx.scope = "connection"', async () => {
    const store = spyStore();
    store.inner.set('key:select 1', { rows: [{ id: 1 }], storedAt: 0 });
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });

    const result = await mw.intercept!(exec, makeCtx({ scope: 'connection' }));
    expect(result).toBeUndefined();
    expect(store.getSpy).not.toHaveBeenCalled();
  });

  it('passes through when ctx.scope = "transaction"', async () => {
    const store = spyStore();
    store.inner.set('key:select 1', { rows: [{ id: 1 }], storedAt: 0 });
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });

    const result = await mw.intercept!(exec, makeCtx({ scope: 'transaction' }));
    expect(result).toBeUndefined();
    expect(store.getSpy).not.toHaveBeenCalled();
  });

  it('does not store rows on connection-scope writes either', async () => {
    const store = spyStore();
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select 1', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx({ scope: 'connection' });

    await mw.intercept!(exec, ctx);
    await mw.onRow!({ id: 1 }, exec, ctx);
    await mw.afterExecute!(
      exec,
      { rowCount: 1, latencyMs: 0, completed: true, source: 'driver' },
      ctx,
    );

    expect(store.setSpy).not.toHaveBeenCalled();
  });
});

describe('createCacheMiddleware — middleware shape', () => {
  it('is a cross-family middleware (no familyId)', () => {
    const mw = createCacheMiddleware({ store: spyStore() });
    expect(mw.familyId).toBeUndefined();
    expect(mw.targetId).toBeUndefined();
  });

  it('exposes a stable name', () => {
    const mw = createCacheMiddleware({ store: spyStore() });
    expect(mw.name).toBe('cache');
  });

  it('wires intercept, onRow, and afterExecute (only)', () => {
    const mw = createCacheMiddleware({ store: spyStore() });
    expect(mw.intercept).toBeDefined();
    expect(mw.onRow).toBeDefined();
    expect(mw.afterExecute).toBeDefined();
    // No beforeExecute — the cache middleware doesn't observe the pre-
    // execute event.
    expect(mw.beforeExecute).toBeUndefined();
  });

  it('defaults to an in-memory LRU store when none is supplied', () => {
    // Smoke: the constructor accepts no store and produces a working
    // middleware. Behavior is exercised by the roundtrip test below.
    const mw = createCacheMiddleware();
    expect(mw.intercept).toBeDefined();
  });

  it('roundtrips a miss-then-hit through the default in-memory store', async () => {
    const mw = createCacheMiddleware({ maxEntries: 10 });
    const exec = makeExec('select roundtrip', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx();

    // Miss.
    expect(await mw.intercept!(exec, ctx)).toBeUndefined();
    await mw.onRow!({ id: 1 }, exec, ctx);
    await mw.onRow!({ id: 2 }, exec, ctx);
    await mw.afterExecute!(
      exec,
      { rowCount: 2, latencyMs: 0, completed: true, source: 'driver' },
      ctx,
    );

    // Hit on the next call.
    const second = await mw.intercept!(exec, ctx);
    expect(second).toBeDefined();
    expect(await drain(second!.rows as AsyncIterable<Record<string, unknown>>)).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
  });

  it('respects a user-supplied custom CacheStore', async () => {
    const store = createInMemoryCacheStore({ maxEntries: 5 });
    const mw = createCacheMiddleware({ store });
    const exec = makeExec('select custom', {
      cache: cacheAnnotation({ ttl: 60_000 }),
    });
    const ctx = makeCtx();

    await mw.intercept!(exec, ctx);
    await mw.onRow!({ id: 7 }, exec, ctx);
    await mw.afterExecute!(
      exec,
      { rowCount: 1, latencyMs: 0, completed: true, source: 'driver' },
      ctx,
    );

    const stored = await store.get('key:custom-not-this');
    expect(stored).toBeUndefined();
    const real = await store.get('key:select custom');
    expect(real?.rows).toEqual([{ id: 7 }]);
  });
});
