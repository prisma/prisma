/**
 * Produces a deterministic, JSON-like string representation of a value.
 *
 * Designed for use as a stable identity / cache key. Two values that are
 * structurally equivalent — regardless of object key insertion order —
 * produce the same string. Two values that differ in any meaningful way
 * (including types that JSON would conflate, like `BigInt(1)` vs `1`)
 * produce different strings.
 *
 * Supported inputs:
 * - `null`, `undefined` (distinguishable: `null` → `"null"`, `undefined` → `"undefined"`)
 * - `boolean`, `string`, `number` (including `NaN`, `Infinity`, `-Infinity`)
 * - `bigint` (suffixed with `n` to disambiguate from `number`)
 * - `Date` (tagged + ISO string)
 * - `Buffer` / `Uint8Array` (tagged + hex-encoded as `Bytes(<hex>)`)
 * - Other `ArrayBuffer` views — `Int8Array`, `Uint16Array`, `Float64Array`,
 *   `DataView`, etc. (tagged with the constructor name + hex-encoded over
 *   the underlying bytes, e.g. `Uint16Array(<hex>)`). Note that the bytes
 *   are read in host byte order, so callers that need cross-platform
 *   stability for multi-byte typed arrays should normalize endianness
 *   before passing the value in.
 * - Arrays (order-preserving)
 * - Plain objects (key-sorted) — only objects whose prototype is
 *   `Object.prototype` or `null`. Non-plain objects (`Map`, `Set`,
 *   `RegExp`, class instances, etc.) are rejected so they cannot silently
 *   collapse to `{}` and collide with each other.
 *
 * Throws on `function`, `symbol`, circular references, non-plain objects,
 * and objects with symbol-keyed properties (which `Object.keys` would
 * silently drop). Callers that need to canonicalize any of these must
 * convert them to a supported representation first.
 *
 * The output format is intentionally not JSON: the type tags and BigInt
 * suffix mean it cannot be round-tripped via `JSON.parse`. The goal is
 * keying, not serialization.
 *
 * @example
 * ```typescript
 * canonicalStringify({ a: 1, b: 2 }) === canonicalStringify({ b: 2, a: 1 })
 * // → true
 *
 * canonicalStringify(1n) !== canonicalStringify(1)
 * // → true
 * ```
 */
export function canonicalStringify(value: unknown): string {
  return write(value, new Set());
}

function write(value: unknown, seen: Set<object>): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return writeNumber(value);
    case 'bigint':
      return `${value.toString()}n`;
    case 'string':
      return JSON.stringify(value);
    case 'function':
      throw new TypeError('canonicalStringify: functions are not supported');
    case 'symbol':
      throw new TypeError('canonicalStringify: symbols are not supported');
  }

  // From here, value is a non-null object.
  const obj = value as object;

  // Leaf object types are handled before touching `seen`: they can never
  // contain back-references, so cycle tracking is wasted work for them.
  if (value instanceof Date) {
    return `Date(${value.toISOString()})`;
  }

  // `Buffer` is a `Uint8Array` subclass; this branch covers both, and
  // emits the legacy `Bytes(<hex>)` tag so a `Buffer` and a same-content
  // `Uint8Array` digest identically.
  if (value instanceof Uint8Array) {
    return `Bytes(${bytesToHex(value)})`;
  }

  // Any other `ArrayBuffer` view — typed arrays (`Int8Array`,
  // `Uint16Array`, `Float64Array`, …) and `DataView`. Without this
  // branch they would fall through to the plain-object writer and
  // canonicalize as `{"0":1,"1":2,...}`, which would silently collide
  // with a same-keyed plain object. Tagging by constructor name keeps
  // distinct view families distinct.
  if (ArrayBuffer.isView(value)) {
    const tag = value.constructor.name;
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return `${tag}(${bytesToHex(bytes)})`;
  }

  if (seen.has(obj)) {
    throw new TypeError('canonicalStringify: circular reference detected');
  }
  seen.add(obj);
  try {
    if (Array.isArray(value)) {
      const parts = value.map((item) => write(item, seen));
      return `[${parts.join(',')}]`;
    }

    return writePlainObject(obj as Record<string, unknown>, seen);
  } finally {
    seen.delete(obj);
  }
}

function writeNumber(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Number.POSITIVE_INFINITY) return 'Infinity';
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  // Distinguish `+0` from `-0` so they hash differently.
  if (value === 0 && 1 / value === Number.NEGATIVE_INFINITY) return '-0';
  return String(value);
}

function writePlainObject(obj: Record<string, unknown>, seen: Set<object>): string {
  // Only true plain objects are accepted here. Without this guard, anything
  // that fell through the type-tagged branches above (`Map`, `Set`,
  // `RegExp`, class instances, …) would canonicalize to `{}` because
  // `Object.keys` returns no enumerable string keys for them — silently
  // colliding with each other and with the literal `{}`.
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) {
    const tag = proto?.constructor?.name ?? 'unknown';
    throw new TypeError(`canonicalStringify: non-plain objects are not supported (got ${tag})`);
  }

  // `Object.keys` ignores symbol-keyed properties, so they would be
  // silently dropped from the canonical form. Force callers to handle
  // them explicitly instead of producing a key that omits real data.
  if (Object.getOwnPropertySymbols(obj).length > 0) {
    throw new TypeError(
      'canonicalStringify: objects with symbol-keyed properties are not supported',
    );
  }

  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const key of keys) {
    parts.push(`${JSON.stringify(key)}:${write(obj[key], seen)}`);
  }
  return `{${parts.join(',')}}`;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number;
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}
