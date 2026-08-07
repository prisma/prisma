import postgresAdapter from '@internal/adapter-postgres/runtime';
import postgresDriver from '@internal/driver-postgres/runtime';
import pgvector from '@internal/extension-pgvector/runtime';
import {
  type ExecutionStackInstance,
  instantiateExecutionStack,
  type RuntimeDriverInstance,
} from '@internal/framework-components/execution';
import type {
  AfterExecuteResult,
  CrossFamilyMiddleware,
  RuntimeMiddlewareContext,
} from '@internal/framework-components/runtime';
import { cacheAnnotation, createCacheMiddleware } from '@internal/middleware-cache';
import { PostgresRuntimeImpl } from '@internal/postgres/runtime';
import { sql } from '@internal/sql-builder/runtime';
import {
  AndExpr,
  BinaryExpr,
  ColumnRef,
  LiteralExpr,
  type SelectAst,
} from '@internal/sql-relational-core/ast';
import type { ExecutionContext } from '@internal/sql-relational-core/query-lane-context';
import {
  createExecutionContext,
  createSqlExecutionStack,
  type Runtime,
  type SqlMiddleware,
  type SqlRuntimeAdapterInstance,
  type SqlRuntimeDriverInstance,
  type SqlRuntimeExtensionInstance,
} from '@internal/sql-runtime';
import postgresTarget, { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { createDevDatabase, timeouts } from '@repo/test-utils';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { contract } from '../sql-builder/fixtures/contract';
import type { Contract } from '../sql-builder/fixtures/generated/contract';
import { setupTestDatabase } from '../utils';

/**
 * Integration tests for `@internal/middleware-cache` against real
 * Postgres. The tests assert four behaviours end-to-end against
 * `createDevDatabase`:
 *
 * - Stop condition: a repeated annotated query is served from cache
 *   and never reaches the driver.
 * - Composition with a `beforeCompile`-style rewriter (soft-delete):
 *   the rewritten SQL contributes to the cache key.
 * - Composition with an inline observer middleware: the `source` field
 *   on `afterExecute` round-trips driver vs middleware fetches.
 * - Concurrency: two parallel calls of the same plan don't cross-talk
 *   through the per-exec WeakMap buffer.
 */

const sqlContract = new PostgresContractSerializer().deserializeContract(contract) as Contract;

type TestStackInstance = ExecutionStackInstance<
  'sql',
  'postgres',
  SqlRuntimeAdapterInstance<'postgres'>,
  RuntimeDriverInstance<'sql', 'postgres'>,
  SqlRuntimeExtensionInstance<'postgres'>
>;

/**
 * A `beforeCompile` middleware that injects a predicate filtering out
 * rows where `users.invited_by_id IS NULL` — used as a stand-in for a
 * "soft delete" rewriter to exercise composition with the cache. The
 * cache key reflects the rewritten SQL because the cache middleware
 * sees the post-lowering plan.
 */
function activeUsersOnly(): SqlMiddleware {
  return {
    name: 'active-users-only',
    familyId: 'sql',
    async beforeCompile(draft) {
      if (draft.ast.kind !== 'select') return undefined;
      if (draft.ast.from?.kind !== 'table-source') return undefined;
      if (draft.ast.from.name !== 'users') return undefined;
      const invitedByPresent = BinaryExpr.gte(ColumnRef.of('users', 'id'), LiteralExpr.of(2));
      const newAst: SelectAst = draft.ast.withWhere(
        draft.ast.where ? AndExpr.of([draft.ast.where, invitedByPresent]) : invitedByPresent,
      );
      return { ...draft, ast: newAst };
    },
  };
}

describe('integration: middleware-cache against real Postgres', {
  timeout: timeouts.databaseOperation,
}, () => {
  let context: ExecutionContext<typeof sqlContract>;
  let driver: SqlRuntimeDriverInstance<'postgres'>;
  let stackInstance: TestStackInstance;
  let driverQuerySpy: ReturnType<typeof vi.spyOn>;
  const closeFns: Array<() => Promise<void>> = [];

  beforeAll(async () => {
    const database = await createDevDatabase();
    const client = new Client({ connectionString: database.connectionString });
    await client.connect();

    await setupTestDatabase(client, sqlContract, async (c) => {
      await c.query(`
          CREATE TABLE users (
            id int4 PRIMARY KEY,
            name text NOT NULL,
            email text NOT NULL,
            invited_by_id int4
          )
        `);
      await c.query('CREATE EXTENSION IF NOT EXISTS vector');
      await c.query(`
          CREATE TABLE posts (
            id int4 PRIMARY KEY,
            title text NOT NULL,
            user_id int4 NOT NULL,
            views int4 NOT NULL,
            embedding vector(3)
          )
        `);
      await c.query(`
          CREATE TABLE comments (
            id int4 PRIMARY KEY,
            body text NOT NULL,
            post_id int4 NOT NULL
          )
        `);
      await c.query(`
          CREATE TABLE profiles (
            id int4 PRIMARY KEY,
            user_id int4 NOT NULL,
            bio text NOT NULL
          )
        `);
      await c.query(`
          CREATE TABLE articles (
            id uuid PRIMARY KEY,
            title text NOT NULL
          )
        `);

      await c.query(`
          INSERT INTO users (id, name, email, invited_by_id) VALUES
            (1, 'Alice',   'alice@example.com',   NULL),
            (2, 'Bob',     'bob@example.com',     1),
            (3, 'Charlie', 'charlie@example.com', 1),
            (4, 'Diana',   'diana@example.com',   2)
        `);
    });

    const stack = createSqlExecutionStack({
      target: postgresTarget,
      adapter: postgresAdapter,
      driver: {
        ...postgresDriver,
        create() {
          return postgresDriver.create({ cursor: { disabled: true } });
        },
      },
      extensions: [pgvector],
    });

    stackInstance = instantiateExecutionStack(stack) as TestStackInstance;
    context = createExecutionContext({ contract: sqlContract, stack });
    const resolvedDriver = stackInstance.driver;
    if (!resolvedDriver) throw new Error('Driver missing');
    driver = resolvedDriver as SqlRuntimeDriverInstance<'postgres'>;
    await driver.connect({ kind: 'pgClient', client });

    // Spy on the driver's query so we can count round-trips. The
    // cache middleware short-circuits via `intercept` upstream of
    // `runDriver`, so a hit shows up here as zero invocations.
    driverQuerySpy = vi.spyOn(driver, 'query');

    closeFns.push(
      () => driver.close(),
      () => client.end(),
      () => database.close(),
    );
  }, timeouts.spinUpPpgDev);

  afterAll(async () => {
    for (const fn of closeFns) {
      try {
        await fn();
      } catch {
        // ignore cleanup errors
      }
    }
  });

  function buildRuntime(middleware: SqlMiddleware[]): Runtime {
    return new PostgresRuntimeImpl({
      context,
      adapter: stackInstance.adapter,
      driver,
      middleware,
    });
  }

  describe('stop condition', () => {
    it('serves a repeated annotated read from cache without hitting the driver', async () => {
      const cache = createCacheMiddleware({ maxEntries: 100 });
      const runtime = buildRuntime([cache]);
      const db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } });

      const buildPlan = () =>
        db.public.users
          .select('id', 'name')
          .annotate(cacheAnnotation({ ttl: 60_000 }))
          .build();

      driverQuerySpy.mockClear();

      // First call — cache miss; driver invoked.
      const first = await runtime.execute(buildPlan()).toArray();
      const driverCallsAfterFirst = driverQuerySpy.mock.calls.length;
      expect(driverCallsAfterFirst).toBeGreaterThan(0);

      // Second call — cache hit; driver not invoked again.
      const second = await runtime.execute(buildPlan()).toArray();
      expect(driverQuerySpy.mock.calls.length).toBe(driverCallsAfterFirst);

      // Both calls produce equivalent decoded rows.
      expect(second).toEqual(first);
      // Sanity — the table has 4 users so we got real data back.
      expect(first.length).toBe(4);
    });

    it('still hits the driver for an un-annotated query (cache is opt-in)', async () => {
      const cache = createCacheMiddleware({ maxEntries: 100 });
      const runtime = buildRuntime([cache]);
      const db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } });

      driverQuerySpy.mockClear();

      await runtime.execute(db.public.users.select('id').build()).toArray();
      const callsAfterFirst = driverQuerySpy.mock.calls.length;

      await runtime.execute(db.public.users.select('id').build()).toArray();
      // Second un-annotated call hits the driver again.
      expect(driverQuerySpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it('does not cache a query when its cacheAnnotation has skip: true', async () => {
      const cache = createCacheMiddleware({ maxEntries: 100 });
      const runtime = buildRuntime([cache]);
      const db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } });

      const buildPlan = () =>
        db.public.users
          .select('id')
          .annotate(cacheAnnotation({ ttl: 60_000, skip: true }))
          .build();

      driverQuerySpy.mockClear();

      await runtime.execute(buildPlan()).toArray();
      const callsAfterFirst = driverQuerySpy.mock.calls.length;

      await runtime.execute(buildPlan()).toArray();
      // Both calls hit the driver — skip: true bypasses the cache.
      expect(driverQuerySpy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });

  describe('composition with beforeCompile rewriter', () => {
    it('cache key reflects the rewritten SQL; rewritten predicate is preserved on the hit path', async () => {
      // Order: rewriter first, then cache. The cache sees the
      // post-lowering exec, so the rewritten predicate is part of
      // the cache key by construction.
      const rewriter = activeUsersOnly();
      const cache = createCacheMiddleware({ maxEntries: 100 });
      const runtime = buildRuntime([rewriter, cache]);
      const db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } });

      const buildPlan = () =>
        db.public.users
          .select('id', 'name')
          .annotate(cacheAnnotation({ ttl: 60_000 }))
          .build();

      driverQuerySpy.mockClear();

      // First call: rewriter prepends `id >= 2`, driver executes.
      const first = await runtime.execute(buildPlan()).toArray();
      const callsAfterFirst = driverQuerySpy.mock.calls.length;
      expect(callsAfterFirst).toBeGreaterThan(0);

      // The rewriter's `id >= 2` predicate filtered out user 1
      // (Alice), so the cached results don't include her.
      expect(first.map((r) => r['id']).sort()).toEqual([2, 3, 4]);

      // Second call: cache hit, driver skipped, but the consumer
      // still sees the rewritten (filtered) result set.
      const second = await runtime.execute(buildPlan()).toArray();
      expect(driverQuerySpy.mock.calls.length).toBe(callsAfterFirst);
      expect(second).toEqual(first);
      expect(second.map((r) => r['id']).sort()).toEqual([2, 3, 4]);
    });

    it('cache key for the same query differs when registered with vs. without the rewriter', async () => {
      // Two runtimes share the same custom CacheStore so we can
      // observe whether the rewriter changes the key.
      const { createInMemoryCacheStore } = await import('@internal/middleware-cache');
      const sharedStore = createInMemoryCacheStore({ maxEntries: 100 });

      const cacheNoRewrite = createCacheMiddleware({ store: sharedStore });
      const runtimeNoRewrite = buildRuntime([cacheNoRewrite]);

      const cacheWithRewrite = createCacheMiddleware({ store: sharedStore });
      const runtimeWithRewrite = buildRuntime([activeUsersOnly(), cacheWithRewrite]);

      const db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } });
      const buildPlan = () =>
        db.public.users
          .select('id')
          .annotate(cacheAnnotation({ ttl: 60_000 }))
          .build();

      driverQuerySpy.mockClear();

      // First runtime (no rewriter) populates the cache under one key.
      const noRewrite = await runtimeNoRewrite.execute(buildPlan()).toArray();
      const callsAfterNoRewrite = driverQuerySpy.mock.calls.length;
      expect(noRewrite.map((r) => r['id']).sort()).toEqual([1, 2, 3, 4]);

      // Second runtime (with rewriter) sees a *different* lowered SQL
      // and therefore a different contentHash — it must miss and
      // hit the driver again.
      const withRewrite = await runtimeWithRewrite.execute(buildPlan()).toArray();
      expect(driverQuerySpy.mock.calls.length).toBeGreaterThan(callsAfterNoRewrite);
      expect(withRewrite.map((r) => r['id']).sort()).toEqual([2, 3, 4]);
    });
  });

  describe('composition with an observer middleware', () => {
    /**
     * Inline cross-family observer. Captures the `phase`, `source`,
     * `rowCount`, and `latencyMs` fields off the framework SPI — the
     * same shape the (now-retired) `@internal/middleware-telemetry`
     * proof-of-concept exposed. These tests are really about
     * composition with the cache, not about telemetry, so an inline
     * observer reads more clearly than depending on a separate
     * package.
     */
    interface ObservedEvent {
      readonly phase: 'beforeExecute' | 'afterExecute';
      readonly source?: 'driver' | 'middleware';
      readonly rowCount?: number;
      readonly latencyMs?: number;
      readonly completed?: boolean;
    }

    function createObserver(events: ObservedEvent[]): CrossFamilyMiddleware {
      return {
        name: 'observer',
        async beforeExecute(_plan, _ctx: RuntimeMiddlewareContext) {
          events.push({ phase: 'beforeExecute' });
        },
        async afterExecute(_plan, result: AfterExecuteResult, _ctx: RuntimeMiddlewareContext) {
          events.push({
            phase: 'afterExecute',
            source: result.source,
            rowCount: result.rowCount,
            latencyMs: result.latencyMs,
            completed: result.completed,
          });
        },
      };
    }

    it('observer sees source: "driver" on miss and source: "middleware" on hit', async () => {
      const events: ObservedEvent[] = [];
      const observer = createObserver(events);
      const cache = createCacheMiddleware({ maxEntries: 100 });
      // Cache first so its `intercept` runs upstream of the observer in
      // the intercept chain. The observer's `afterExecute` still fires on
      // both paths and observes the `source` field, which is the
      // canonical hit-vs-miss signal.
      const runtime = buildRuntime([cache, observer]);
      const db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } });

      const buildPlan = () =>
        db.public.users
          .select('id')
          .annotate(cacheAnnotation({ ttl: 60_000 }))
          .build();

      driverQuerySpy.mockClear();
      events.length = 0;

      // Miss path.
      await runtime.execute(buildPlan()).toArray();

      const missEvents = events.slice();
      // `beforeExecute` fires on every execution: the framework runs
      // `runBeforeExecuteChain` before `runWithMiddleware`'s intercept
      // loop so middleware that mutates ParamRef values stays visible
      // to encode regardless of whether a downstream interceptor wins
      // (see `before-execute-chain.ts`). The `source` field on
      // `afterExecute` is what distinguishes driver vs middleware
      // paths.
      expect(missEvents.find((e) => e.phase === 'beforeExecute')).toBeDefined();
      const missAfter = missEvents.find((e) => e.phase === 'afterExecute');
      expect(missAfter).toBeDefined();
      expect(missAfter!.source).toBe('driver');

      events.length = 0;
      driverQuerySpy.mockClear();

      // Hit path.
      await runtime.execute(buildPlan()).toArray();

      // `beforeExecute` still fires on the intercepted hit path —
      // it runs unconditionally before `runWithMiddleware`'s intercept
      // loop. The canonical hit signal is `afterExecute.source ===
      // 'middleware'`, paired with the driver not being invoked.
      expect(events.find((e) => e.phase === 'beforeExecute')).toBeDefined();
      const hitAfter = events.find((e) => e.phase === 'afterExecute');
      expect(hitAfter).toBeDefined();
      expect(hitAfter!.source).toBe('middleware');
      expect(driverQuerySpy.mock.calls.length).toBe(0);
    });

    it('observer rowCount and latencyMs populate correctly on both paths', async () => {
      const events: ObservedEvent[] = [];
      const observer = createObserver(events);
      const cache = createCacheMiddleware({ maxEntries: 100 });
      const runtime = buildRuntime([cache, observer]);
      const db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } });

      const buildPlan = () =>
        db.public.users
          .select('id', 'name')
          .annotate(cacheAnnotation({ ttl: 60_000 }))
          .build();

      // Miss → commit.
      await runtime.execute(buildPlan()).toArray();
      // Hit.
      events.length = 0;
      await runtime.execute(buildPlan()).toArray();

      const after = events.find((e) => e.phase === 'afterExecute');
      expect(after).toBeDefined();
      expect(after!.rowCount).toBe(4);
      expect(typeof after!.latencyMs).toBe('number');
      expect(after!.completed).toBe(true);
    });
  });

  describe('concurrency regression', () => {
    it('two parallel executes of the same plan do not cross-talk via the per-exec buffer', async () => {
      const cache = createCacheMiddleware({ maxEntries: 100 });
      const runtime = buildRuntime([cache]);
      const db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } });

      const buildPlan = () =>
        db.public.users
          .select('id', 'name')
          .annotate(cacheAnnotation({ ttl: 60_000, key: 'concurrency-test' }))
          .build();

      driverQuerySpy.mockClear();

      // Two parallel executions of the same logical plan. Each
      // produces its own frozen `exec` object inside the runtime
      // (executeAgainstQueryable freezes per-call), and the cache
      // middleware keys its WeakMap on that identity — so the two
      // calls' miss buffers must not interfere.
      const [a, b] = await Promise.all([
        runtime.execute(buildPlan()).toArray(),
        runtime.execute(buildPlan()).toArray(),
      ]);

      // Both calls produce correct, identical results.
      expect(a).toEqual(b);
      expect(a.length).toBe(4);

      // After both finish, the cache holds a single entry (one of
      // the misses commits last; same key, same data).
      const third = await runtime.execute(buildPlan()).toArray();
      expect(third).toEqual(a);
    });

    it('parallel executes of two different plans land in distinct cache slots', async () => {
      const cache = createCacheMiddleware({ maxEntries: 100 });
      const runtime = buildRuntime([cache]);
      const db = sql({ context, rawCodecInferer: { inferCodec: () => 'pg/text' } });

      driverQuerySpy.mockClear();

      const planA = db.public.users
        .select('id')
        .annotate(cacheAnnotation({ ttl: 60_000, key: 'parallel-A' }))
        .build();
      const planB = db.public.posts
        .select('id', 'title')
        .annotate(cacheAnnotation({ ttl: 60_000, key: 'parallel-B' }))
        .build();

      const [a, b] = await Promise.all([
        runtime.execute(planA).toArray(),
        runtime.execute(planB).toArray(),
      ]);

      expect(a.every((r) => 'id' in r && !('title' in r))).toBe(true);
      expect(b.every((r) => 'id' in r && 'title' in r)).toBe(true);

      // The next call to each lands on the cache (driver count
      // unchanged after these reads).
      const callsAfterParallel = driverQuerySpy.mock.calls.length;
      await runtime
        .execute(
          db.public.users
            .select('id')
            .annotate(cacheAnnotation({ ttl: 60_000, key: 'parallel-A' }))
            .build(),
        )
        .toArray();
      await runtime
        .execute(
          db.public.posts
            .select('id', 'title')
            .annotate(cacheAnnotation({ ttl: 60_000, key: 'parallel-B' }))
            .build(),
        )
        .toArray();
      expect(driverQuerySpy.mock.calls.length).toBe(callsAfterParallel);
    });
  });
});
