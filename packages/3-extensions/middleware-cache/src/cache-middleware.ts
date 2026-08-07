import type {
  AfterQueryResult,
  CrossFamilyMiddleware,
  ExecutionPlan,
  RuntimeMiddlewareContext,
} from '@internal/framework-components/runtime';
import { type CachePayload, cacheAnnotation } from './cache-annotation';
import { type CacheStore, createInMemoryCacheStore } from './cache-store';

/**
 * Options accepted by `createCacheMiddleware`.
 *
 * - `store` — pluggable cache backend. Defaults to an in-process LRU
 *   produced by `createInMemoryCacheStore`. Users supply Redis,
 *   Memcached, or any other backend by implementing the `CacheStore`
 *   interface.
 * - `maxEntries` — only consulted when `store` is omitted. Sets the
 *   `maxEntries` cap on the default in-memory store. Defaults to 1000.
 * - `clock` — injectable time source for `storedAt` stamping on
 *   committed entries. Defaults to `Date.now`. Tests inject a controlled
 *   clock to make commit-time observable. Note: TTL math lives inside
 *   the store, not the middleware — supplying a clock here only affects
 *   the `storedAt` field on committed `CachedEntry` values.
 */
export interface CacheMiddlewareOptions {
  readonly store?: CacheStore;
  readonly maxEntries?: number;
  readonly clock?: () => number;
}

/**
 * Per-execution buffer correlated with the post-lowering `exec` object
 * via a private `WeakMap`. Each in-flight cache miss owns one of these.
 *
 * The plan-identity invariant required by this `WeakMap` correlation is
 * documented in the runtime subsystem doc and pinned by a regression
 * test: family runtimes produce a fresh, frozen `exec` per call (SQL
 * `prepareExecution` constructs `Object.freeze({...lowered, ...})` on each
 * invocation; Mongo lowers fresh per call). If a future plan-
 * memoization change ever recycles `exec` objects across calls, this
 * correlation would silently leak rows between concurrent executions
 * — which is exactly what the regression test catches.
 */
interface PendingMiss {
  readonly key: string;
  readonly ttlMs: number;
  readonly buffer: Record<string, unknown>[];
}

/**
 * Default `maxEntries` for the built-in in-memory store. Bounded so a
 * runaway producer cannot exhaust process memory; users who need
 * different bounds supply a custom `CacheStore`.
 */
const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Reads the cache payload from the plan, if present and branded.
 *
 * Returns `undefined` when:
 * - the plan has no `meta.annotations`, or
 * - the `cache` namespace key is absent, or
 * - the value under `cache` is not a branded `AnnotationValue` (the
 *   `cacheAnnotation.read` defensive check covers this).
 */
function readCachePayload(plan: ExecutionPlan): CachePayload | undefined {
  return cacheAnnotation.read(plan);
}

/**
 * Computes the cache key for an execution.
 *
 * Two-tier resolution:
 *
 * 1. Per-query override: `cacheAnnotation({ key })` — the supplied
 *    string is used verbatim. Not rehashed; the user is responsible for
 *    keeping the string bounded and free of sensitive data.
 * 2. Default: `ctx.contentHash(exec)` — the family runtime owns this and
 *    returns an opaque, bounded digest (SHA-512 in the SQL and Mongo
 *    runtimes today).
 *
 * The returned string is consumed directly as the `Map<string, …>` key
 * by the underlying `CacheStore`; the cache middleware does not perform
 * any further transformation.
 */
async function resolveCacheKey(
  payload: CachePayload,
  exec: ExecutionPlan,
  ctx: RuntimeMiddlewareContext,
): Promise<string> {
  if (payload.key !== undefined) {
    return payload.key;
  }
  return ctx.contentHash(exec);
}

/**
 * Creates a family-agnostic caching middleware.
 *
 * The middleware uses three hooks:
 *
 * - `intercept` — on each execution, checks the cache. On a hit, returns
 *   the cached raw rows; the runtime skips `runDriver` and `onRow`
 *   (`beforeExecute` is not affected — it has already run for every
 *   middleware before any `intercept` is consulted) and yields the
 *   cached rows to the consumer (which, in the SQL runtime, sees them
 *   after the standard `decodeRow` pass — i.e. the cache stores
 *   wire-format values). On a miss, records a pending buffer keyed on
 *   the `exec` object identity and returns `undefined` (passthrough).
 * - `onRow` — on the miss path, appends each row yielded by the driver
 *   to the pending buffer.
 * - `afterExecute` — on the miss path, commits the buffer to the store
 *   if and only if `result.completed === true && result.source === 'driver'`.
 *   Failed executions and middleware-served executions never populate
 *   the cache. The pending buffer is cleared in all branches so a stale
 *   `WeakMap` entry cannot leak between executions sharing an `exec`.
 *
 * The middleware bypasses the cache entirely when:
 * - the plan has no `cache` annotation, or
 * - the annotation has `skip: true`, or
 * - the annotation has no `ttl`, or
 * - `ctx.scope !== 'runtime'` (connection / transaction scopes opt out).
 *
 * Returns a cross-family `RuntimeMiddleware` (no `familyId` /
 * `targetId`). The package depends only on
 * `@internal/framework-components/runtime`; cache keys come from
 * `ctx.contentHash(exec)`, populated by the family runtime, so SQL and
 * Mongo runtimes both work out of the box.
 *
 * @example
 * ```typescript
 * import { createCacheMiddleware, cacheAnnotation } from '@internal/middleware-cache';
 *
 * const db = postgres({
 *   contractJson,
 *   url: process.env['DATABASE_URL']!,
 *   middleware: [createCacheMiddleware({ maxEntries: 1000 })],
 * });
 *
 * const user = await db.User.first(
 *   { id },
 *   (meta) => meta.annotate(cacheAnnotation({ ttl: 60_000 })),
 * );
 * ```
 */
export function createCacheMiddleware(options?: CacheMiddlewareOptions): CrossFamilyMiddleware {
  const store =
    options?.store ??
    createInMemoryCacheStore({
      maxEntries: options?.maxEntries ?? DEFAULT_MAX_ENTRIES,
    });
  const clock = options?.clock ?? Date.now;

  // Per-execution scratch space, keyed on the post-lowering `exec`
  // object identity. WeakMap keeps cleanup automatic: if an execution is
  // dropped without `afterExecute` firing (e.g. an early throw before
  // `operation-specific middleware runner` even starts), the entry is GC'd alongside the
  // exec object.
  const pending = new WeakMap<object, PendingMiss>();

  async function interceptQuery(
    exec: ExecutionPlan,
    ctx: RuntimeMiddlewareContext,
  ): Promise<
    | {
        readonly operation: 'query';
        readonly rows: Iterable<Record<string, unknown>>;
      }
    | undefined
  > {
    if (ctx.scope !== 'runtime' || ctx.operation !== 'query') {
      return undefined;
    }

    const payload = readCachePayload(exec);
    if (payload === undefined) {
      return undefined;
    }
    if (payload.skip === true) {
      return undefined;
    }
    if (payload.ttl === undefined) {
      return undefined;
    }

    const key = await resolveCacheKey(payload, exec, ctx);
    const hit = await store.get(key);
    if (hit !== undefined) {
      ctx.log.debug?.({ event: 'middleware.cache.hit', middleware: 'cache', key });
      // Hit path leaves no WeakMap entry — afterExecute's lookup will
      // return undefined and short-circuit.
      return { operation: 'query', rows: hit.rows };
    }

    // Miss: record the pending buffer so onRow / afterExecute can
    // commit on success. The TTL is captured here so a later mutation
    // of the annotation (defensive) cannot change the commit window.
    pending.set(exec, { key, ttlMs: payload.ttl, buffer: [] });
    ctx.log.debug?.({ event: 'middleware.cache.miss', middleware: 'cache', key });
    return undefined;
  }

  async function onRow(
    row: Record<string, unknown>,
    exec: ExecutionPlan,
    _ctx: RuntimeMiddlewareContext,
  ): Promise<void> {
    const slot = pending.get(exec);
    if (slot === undefined) {
      return;
    }
    slot.buffer.push(row);
  }

  async function afterQuery(
    exec: ExecutionPlan,
    result: AfterQueryResult,
    ctx: RuntimeMiddlewareContext,
  ): Promise<void> {
    const slot = pending.get(exec);
    if (slot === undefined) {
      return;
    }
    // Always release the WeakMap entry — the exec is single-use and
    // any state we leave behind is dead weight on the GC.
    pending.delete(exec);

    if (result.operation !== 'query' || !result.completed || result.source !== 'driver') {
      return;
    }

    await store.set(slot.key, { rows: slot.buffer, storedAt: clock() }, slot.ttlMs);
    ctx.log.debug?.({ event: 'middleware.cache.store', middleware: 'cache', key: slot.key });
  }

  return {
    name: 'cache',
    interceptQuery,
    onRow,
    afterQuery,
  };
}
