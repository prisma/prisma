import { structuredError } from '@internal/utils/structured-error';

/**
 * The rows one statement produced, stored raw (undecoded). The SQL runtime decodes intercepted rows
 * the same way as driver rows, so a hit and a miss yield the same values to the consumer.
 */
export type CachedRows = readonly Record<string, unknown>[];

/**
 * The value type the cache middleware stores: a statement's raw rows, or the result of a call a
 * client started, such as an ORM call. The middleware serves a value only to an activity of the
 * kind that stored it; a value of the other kind under the same key is a miss.
 */
export type CachedValue =
  | { readonly kind: 'rows'; readonly rows: CachedRows }
  | { readonly kind: 'result'; readonly result: unknown };

/**
 * One key of a `CacheStore`, as `get` saw it.
 *
 * - `key` and `meta` — what `get` was asked for. `meta` is the read annotation's `meta`, or
 *   `undefined`.
 * - `version` — the key's version when `get` ran. A store that matches `meta` folds the versions
 *   of whatever `meta` names into it.
 * - `data` — `{ empty: true }` when the store holds no live value for the key, otherwise that
 *   value.
 */
export interface CacheEntry<TMeta = unknown, TValue = CachedValue> {
  readonly key: string;
  readonly meta: TMeta | undefined;
  readonly version: number;
  readonly data: { readonly empty: true } | { readonly empty: false; readonly value: TValue };
}

/**
 * A cache of values that the cache middleware reads from and writes to. The middleware stores
 * `CachedValue`.
 *
 * The store keeps a version per key, an integer it keeps even for a key that holds no value. A key
 * never seen, or forgotten, has version 0. Only `unset` changes a version.
 *
 * - `get` always returns an entry: the live value or `{ empty: true }`, and the current version.
 *   A store that matches `meta` folds the versions of whatever `meta` names into that version, and
 *   does the same when `set` compares, so an `unset` by `meta` refuses a read's `set` even for a
 *   key it has never seen.
 * - `set(entry, value)` stores `value` under `entry.key` with `entry.meta`, if and only if the
 *   key's current version still equals `entry.version`, and returns whether it stored. `entry` is
 *   the one `get` returned, empty or not. There is no unconditional write: to prefill, `get` then
 *   `set`. The compare and the write must be atomic with respect to `unset`, for example one
 *   synchronous step in memory or one script on a server.
 * - `unset` removes every value named in `keys` and every value that matches `meta`, and
 *   increments the version of every key it removes or would remove, including keys that hold no
 *   value. `keys` is `undefined` or non-empty. A store that cannot act on a `meta` it is given
 *   must throw rather than ignore it. An `unset` by key must also drop that key from any `meta`
 *   index the store keeps.
 *
 * Lifetime, eviction and whether values are copied are the store's policy; the middleware hands
 * `set` the value it returns to its caller, so a store that keeps references shares that object. A version that `unset` moved must be kept at least
 * as long as a read can take, so that a read that started before the `unset` cannot store. `unset`
 * must not run queries through the runtime that uses the middleware.
 *
 * `TMeta` is the shape of `meta` the store understands. The middleware does not check that a read
 * annotation's `meta` has this shape; see `cacheAnnotation`.
 */
export interface CacheStore<TMeta = unknown, TValue = CachedValue> {
  get(target: {
    readonly key: string;
    readonly meta: TMeta | undefined;
  }): Promise<CacheEntry<TMeta, TValue>>;
  set(entry: CacheEntry<TMeta, TValue>, value: TValue): Promise<boolean>;
  unset(target: {
    readonly keys: readonly string[] | undefined;
    readonly meta: TMeta | undefined;
  }): Promise<void>;
}

/**
 * Options for `createInMemoryCacheStore`.
 *
 * - `maxEntries` — the most values kept, a positive integer; the least recently used is evicted
 *   first. Default 1000.
 * - `ttlMs` — how long a value lives after its `set`, and how long a key's version is kept after
 *   the `unset` that moved it, a positive number of milliseconds. Default 60 000. Versions are not
 *   bounded by `maxEntries`. A forgotten version reads as 0, so a read that takes longer than
 *   `ttlMs` and overlaps an `invalidate` can store stale rows. `Infinity` never expires values or
 *   versions: the versions of invalidated keys are never forgotten, and grow with the number of
 *   distinct keys invalidated.
 * - `clock` — the time source for expiry. Default `Date.now`.
 */
export interface InMemoryCacheStoreOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
  readonly clock?: () => number;
}

const clonedPrototypes: ReadonlySet<object | null> = new Set<object | null>([
  null,
  Object.prototype,
  Array.prototype,
  Date.prototype,
  RegExp.prototype,
  Map.prototype,
  Set.prototype,
  ArrayBuffer.prototype,
  DataView.prototype,
  Int8Array.prototype,
  Uint8Array.prototype,
  Uint8ClampedArray.prototype,
  Int16Array.prototype,
  Uint16Array.prototype,
  Int32Array.prototype,
  Uint32Array.prototype,
  Float32Array.prototype,
  Float64Array.prototype,
  BigInt64Array.prototype,
  BigUint64Array.prototype,
  Error.prototype,
  EvalError.prototype,
  RangeError.prototype,
  ReferenceError.prototype,
  SyntaxError.prototype,
  TypeError.prototype,
  URIError.prototype,
]);

/** Whether `structuredClone` copies `value` without changing what it is: no function, no symbol, and no object whose prototype it would drop, such as a class instance. */
function clonesFaithfully(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === 'function' || typeof value === 'symbol') return false;
  if (typeof value !== 'object' || value === null) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!clonedPrototypes.has(Object.getPrototypeOf(value))) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;
  if (value instanceof Map) {
    return [...value].every(
      ([key, entry]) => clonesFaithfully(key, seen) && clonesFaithfully(entry, seen),
    );
  }
  if (value instanceof Set) {
    return [...value].every((entry) => clonesFaithfully(entry, seen));
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return true;
  return Object.values(value).every((entry) => clonesFaithfully(entry, seen));
}

interface StoredRecord<TValue> {
  readonly value: TValue;
  readonly expiresAt: number;
}

interface VersionRecord {
  readonly version: number;
  readonly expiresAt: number;
}

function metaUnsupported() {
  return structuredError(
    'RUNTIME.CACHE_STORE_META_UNSUPPORTED',
    'The in-memory cache store cannot remove entries by meta because it does not index meta',
    { fix: 'Invalidate by keys, or supply a CacheStore that indexes meta in set and unset.' },
  );
}

function invalidOption(argument: 'maxEntries' | 'ttlMs', received: number, expected: string) {
  return structuredError(
    'RUNTIME.ARGUMENT_INVALID',
    `createInMemoryCacheStore: ${argument} must be ${expected}`,
    {
      fix: `Pass ${argument} as ${expected}, or leave it unset for the default.`,
      meta: { helper: 'createInMemoryCacheStore', argument, received },
    },
  );
}

/**
 * The default cache store: a least-recently-used map with one lifetime for every value, local to
 * the process. It holds `CachedValue` unless given another `TValue`. It holds copies: `set` stores a
 * `structuredClone` of the value and `get` returns a fresh one, so no caller shares an object with
 * the cache. It stores only plain data that `structuredClone` copies faithfully; for a value holding
 * a function, a symbol or an object of another prototype, such as a class instance, `set` stores
 * nothing and returns `false`. A key's version is kept for
 * `ttlMs` after the `unset` that moved it (see `InMemoryCacheStoreOptions`). It ignores `meta` in
 * `get` and `set`, and its `unset` rejects any `meta`, including `null`, before changing anything.
 * It throws `RUNTIME.ARGUMENT_INVALID` for a `maxEntries` or `ttlMs` outside the ranges above.
 */
export function createInMemoryCacheStore<TMeta = unknown, TValue = CachedValue>(
  options?: InMemoryCacheStoreOptions,
): CacheStore<TMeta, TValue> {
  const maxEntries = options?.maxEntries ?? 1000;
  const ttlMs = options?.ttlMs ?? 60_000;
  const clock = options?.clock ?? Date.now;
  if (!Number.isInteger(maxEntries) || maxEntries <= 0) {
    throw invalidOption('maxEntries', maxEntries, 'a positive integer');
  }
  if (!(ttlMs > 0)) {
    throw invalidOption('ttlMs', ttlMs, 'a positive number of milliseconds, or Infinity');
  }
  const records = new Map<string, StoredRecord<TValue>>();
  const versions = new Map<string, VersionRecord>();

  function forgetExpiredVersions(): void {
    const now = clock();
    for (const [key, record] of versions) {
      if (now < record.expiresAt) {
        return;
      }
      versions.delete(key);
    }
  }

  function versionOf(key: string): number {
    forgetExpiredVersions();
    return versions.get(key)?.version ?? 0;
  }

  function liveRecord(key: string): StoredRecord<TValue> | undefined {
    const record = records.get(key);
    if (record === undefined) {
      return undefined;
    }
    records.delete(key);
    if (clock() >= record.expiresAt) {
      return undefined;
    }
    records.set(key, record);
    return record;
  }

  async function get(target: {
    readonly key: string;
    readonly meta: TMeta | undefined;
  }): Promise<CacheEntry<TMeta, TValue>> {
    const record = liveRecord(target.key);
    return {
      key: target.key,
      meta: target.meta,
      version: versionOf(target.key),
      data:
        record === undefined
          ? { empty: true }
          : { empty: false, value: structuredClone(record.value) },
    };
  }

  async function set(entry: CacheEntry<TMeta, TValue>, value: TValue): Promise<boolean> {
    if (entry.version !== versionOf(entry.key) || !clonesFaithfully(value)) {
      return false;
    }
    records.delete(entry.key);
    records.set(entry.key, { value: structuredClone(value), expiresAt: clock() + ttlMs });
    for (const leastRecentlyUsed of records.keys()) {
      if (records.size <= maxEntries) {
        break;
      }
      records.delete(leastRecentlyUsed);
    }
    return true;
  }

  async function unset(target: {
    readonly keys: readonly string[] | undefined;
    readonly meta: TMeta | undefined;
  }): Promise<void> {
    if (target.meta !== undefined) {
      throw metaUnsupported();
    }
    for (const key of target.keys ?? []) {
      records.delete(key);
      const version = versionOf(key) + 1;
      versions.delete(key);
      versions.set(key, { version, expiresAt: clock() + ttlMs });
    }
  }

  return { get, set, unset };
}
