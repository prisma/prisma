import { blindCast } from '@internal/utils/casts';
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

const copiedPrototypes: ReadonlySet<object | null> = new Set<object | null>([
  null,
  Object.prototype,
  Array.prototype,
  Date.prototype,
  RegExp.prototype,
  Map.prototype,
  Set.prototype,
  ArrayBuffer.prototype,
]);

const typedArraySlice: (this: ArrayBufferView) => ArrayBufferView = Reflect.get(
  Object.getPrototypeOf(Uint8Array.prototype),
  'slice',
);

/** Temporal values, native or polyfilled, are immutable, so a copy can share them. */
function isTemporalValue(value: object): boolean {
  return Object.prototype.toString.call(value).startsWith('[object Temporal.');
}

/** Whether `copyValue` can copy `value` as it is: no function, no symbol, and no object of a prototype it does not copy, such as a class instance or an error. Any typed array or `DataView` is accepted, including a subclass such as Node's `Buffer`. */
function deepCopyable(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === 'function' || typeof value === 'symbol') return false;
  if (typeof value !== 'object' || value === null) return true;
  if (ArrayBuffer.isView(value) || isTemporalValue(value)) return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!copiedPrototypes.has(Object.getPrototypeOf(value))) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;
  if (value instanceof Map) {
    return [...value].every(([key, entry]) => deepCopyable(key, seen) && deepCopyable(entry, seen));
  }
  if (value instanceof Set) {
    return [...value].every((entry) => deepCopyable(entry, seen));
  }
  if (value instanceof ArrayBuffer) return true;
  return Object.values(value).every((entry) => deepCopyable(entry, seen));
}

/** A deep copy of a value `deepCopyable` accepts. A typed array is copied with `TypedArray.prototype.slice`, which keeps its class, so a `Buffer` copies to a `Buffer` with its own memory; a `DataView` copies to a plain `DataView`; an array copies to its elements only, with holes read as `undefined`. */
function copyValue<T>(value: T, copies = new Map<object, unknown>()): T {
  if (typeof value !== 'object' || value === null) return value;
  const known = copies.get(value);
  if (known !== undefined)
    return blindCast<T, 'the copy of a value has the type of the value'>(known);
  const copy = copyObject(value, copies);
  copies.set(value, copy);
  return blindCast<T, 'the copy of a value has the type of the value'>(copy);
}

function copyObject(value: object, copies: Map<object, unknown>): unknown {
  if (isTemporalValue(value)) return value;
  if (value instanceof DataView) {
    const start = value.byteOffset;
    return new DataView(value.buffer.slice(start, start + value.byteLength));
  }
  if (ArrayBuffer.isView(value)) return typedArraySlice.call(value);
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>();
    copies.set(value, copy);
    for (const [key, entry] of value) copy.set(copyValue(key, copies), copyValue(entry, copies));
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set<unknown>();
    copies.set(value, copy);
    for (const entry of value) copy.add(copyValue(entry, copies));
    return copy;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    copies.set(value, copy);
    for (const entry of value) copy.push(copyValue(entry, copies));
    return copy;
  }
  const copy: Record<string, unknown> = Object.create(Object.getPrototypeOf(value));
  copies.set(value, copy);
  for (const [key, entry] of Object.entries(value)) copy[key] = copyValue(entry, copies);
  return copy;
}

function isStatementRows(
  value: unknown,
): value is { readonly kind: 'rows'; readonly rows: CachedRows } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Reflect.get(value, 'kind') === 'rows' &&
    Array.isArray(Reflect.get(value, 'rows'))
  );
}

/** Statement rows hold driver values, such as BSON `ObjectId`s, that this package cannot copy; the runtime decodes them into new values on every hit. So the array and each row object are copied, and the driver's values are kept by reference. */
function copyRows(value: { readonly kind: 'rows'; readonly rows: CachedRows }): CachedValue {
  return { kind: 'rows', rows: value.rows.map((row) => ({ ...row })) };
}

function storable(value: unknown): boolean {
  return isStatementRows(value) || deepCopyable(value);
}

function copyStored<TValue>(value: TValue): TValue {
  return isStatementRows(value)
    ? blindCast<TValue, 'statement rows copy to statement rows'>(copyRows(value))
    : copyValue(value);
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
 * the process. It holds `CachedValue` unless given another `TValue`, and keeps statement rows and
 * other values differently. Statement rows (`{ kind: 'rows' }`) are copied one level deep on `set` and
 * `get`, the array and each row object, and the driver's values are kept by reference: the runtime
 * decodes them into new values on every hit. Every other value, such as an ORM call's result, is
 * deep copied on `set` and `get`, so no caller shares an object with the cache. Only plain data is
 * deep copied: primitives, plain objects, arrays (their elements only; holes read as `undefined`),
 * `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, typed arrays (a subclass such as Node's `Buffer`
 * keeps its class) and `DataView` (copied as a plain `DataView`); Temporal values, which are
 * immutable, are kept by reference. For a value holding anything else,
 * such as a function, a symbol, an error or a class instance, `set` stores nothing and returns
 * `false`. A key's version is kept for
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
        record === undefined ? { empty: true } : { empty: false, value: copyStored(record.value) },
    };
  }

  async function set(entry: CacheEntry<TMeta, TValue>, value: TValue): Promise<boolean> {
    if (entry.version !== versionOf(entry.key) || !storable(value)) {
      return false;
    }
    records.delete(entry.key);
    records.set(entry.key, { value: copyStored(value), expiresAt: clock() + ttlMs });
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
