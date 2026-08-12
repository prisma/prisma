import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { canonicalStringify } from '../src/canonical-stringify';

describe('canonicalStringify', () => {
  describe('primitives', () => {
    it('serializes null and undefined distinguishably', () => {
      expect(canonicalStringify(null)).toBe('null');
      expect(canonicalStringify(undefined)).toBe('undefined');
      expect(canonicalStringify(null)).not.toBe(canonicalStringify(undefined));
    });

    it('serializes booleans', () => {
      expect(canonicalStringify(true)).toBe('true');
      expect(canonicalStringify(false)).toBe('false');
    });

    it('serializes finite numbers', () => {
      expect(canonicalStringify(0)).toBe('0');
      expect(canonicalStringify(1)).toBe('1');
      expect(canonicalStringify(-1)).toBe('-1');
      expect(canonicalStringify(1.5)).toBe('1.5');
    });

    it('distinguishes +0 from -0', () => {
      expect(canonicalStringify(0)).toBe('0');
      expect(canonicalStringify(-0)).toBe('-0');
      expect(canonicalStringify(0)).not.toBe(canonicalStringify(-0));
    });

    it('serializes NaN and infinities', () => {
      expect(canonicalStringify(Number.NaN)).toBe('NaN');
      expect(canonicalStringify(Number.POSITIVE_INFINITY)).toBe('Infinity');
      expect(canonicalStringify(Number.NEGATIVE_INFINITY)).toBe('-Infinity');
    });

    it('serializes strings via JSON.stringify so quotes/escapes are stable', () => {
      expect(canonicalStringify('hello')).toBe('"hello"');
      expect(canonicalStringify('with "quotes"')).toBe('"with \\"quotes\\""');
      expect(canonicalStringify('newline\n')).toBe('"newline\\n"');
    });
  });

  describe('BigInt', () => {
    it('suffixes BigInts with `n` to disambiguate from numbers', () => {
      expect(canonicalStringify(1n)).toBe('1n');
      expect(canonicalStringify(0n)).toBe('0n');
      expect(canonicalStringify(-42n)).toBe('-42n');
    });

    it('produces distinct output for BigInt and same-valued number', () => {
      expect(canonicalStringify(1n)).not.toBe(canonicalStringify(1));
      expect(canonicalStringify(0n)).not.toBe(canonicalStringify(0));
    });

    it('handles BigInts beyond Number.MAX_SAFE_INTEGER', () => {
      const huge = 9007199254740993n; // MAX_SAFE_INTEGER + 2
      expect(canonicalStringify(huge)).toBe('9007199254740993n');
    });
  });

  describe('Date', () => {
    it('serializes Date as a tagged ISO string', () => {
      const d = new Date('2026-04-27T12:00:00.000Z');
      expect(canonicalStringify(d)).toBe('Date(2026-04-27T12:00:00.000Z)');
    });

    it('round-trips identical Dates to the same key', () => {
      const a = new Date('2026-01-01T00:00:00.000Z');
      const b = new Date('2026-01-01T00:00:00.000Z');
      expect(canonicalStringify(a)).toBe(canonicalStringify(b));
    });

    it('produces distinct output for distinct Dates', () => {
      const a = new Date('2026-01-01T00:00:00.000Z');
      const b = new Date('2026-01-02T00:00:00.000Z');
      expect(canonicalStringify(a)).not.toBe(canonicalStringify(b));
    });

    it('does not collide with a string of the same ISO value', () => {
      const d = new Date('2026-04-27T12:00:00.000Z');
      expect(canonicalStringify(d)).not.toBe(canonicalStringify(d.toISOString()));
    });
  });

  describe('Uint8Array / Buffer', () => {
    it('serializes Uint8Array as tagged hex', () => {
      const bytes = new Uint8Array([0x00, 0xff, 0x10, 0x42]);
      expect(canonicalStringify(bytes)).toBe('Bytes(00ff1042)');
    });

    it('handles empty Uint8Array', () => {
      expect(canonicalStringify(new Uint8Array())).toBe('Bytes()');
    });

    it('serializes Buffer the same way as the underlying Uint8Array', () => {
      const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
      expect(canonicalStringify(buf)).toBe('Bytes(deadbeef)');
    });

    it('does not collide with an array of byte numbers', () => {
      const bytes = new Uint8Array([1, 2, 3]);
      expect(canonicalStringify(bytes)).not.toBe(canonicalStringify([1, 2, 3]));
    });
  });

  describe('other ArrayBuffer views', () => {
    it('serializes other typed arrays with their constructor-name tag', () => {
      const i16 = new Int16Array([1, 2]);
      const result = canonicalStringify(i16);
      // Tag must be the constructor name, not `Bytes`, so non-Uint8Array
      // typed arrays don't collide with same-byte Uint8Arrays.
      expect(result.startsWith('Int16Array(')).toBe(true);
      expect(result).not.toBe(canonicalStringify(new Uint8Array(i16.buffer.slice(0))));
    });

    it('does not collide with a same-keyed plain object', () => {
      // Without the typed-array branch, an Int8Array would canonicalize as
      // `{"0":1,"1":2,"2":3}` and silently match the plain object below.
      const typed = new Int8Array([1, 2, 3]);
      const plain = { 0: 1, 1: 2, 2: 3 };
      expect(canonicalStringify(typed)).not.toBe(canonicalStringify(plain));
    });

    it('distinguishes typed-array families with the same byte width', () => {
      const u16 = new Uint16Array([0x0102]);
      const i16 = new Int16Array([0x0102]);
      // Same underlying bytes, different element interpretation — the tag
      // keeps them distinct.
      expect(canonicalStringify(u16)).not.toBe(canonicalStringify(i16));
    });

    it('serializes DataView using its byte range', () => {
      const buf = new ArrayBuffer(4);
      new Uint8Array(buf).set([0xde, 0xad, 0xbe, 0xef]);
      const view = new DataView(buf, 1, 2);
      expect(canonicalStringify(view)).toBe('DataView(adbe)');
    });
  });

  describe('arrays', () => {
    it('serializes arrays in order', () => {
      expect(canonicalStringify([1, 2, 3])).toBe('[1,2,3]');
      expect(canonicalStringify(['a', 'b'])).toBe('["a","b"]');
    });

    it('preserves element order (arrays are order-significant)', () => {
      expect(canonicalStringify([1, 2, 3])).not.toBe(canonicalStringify([3, 2, 1]));
    });

    it('handles empty arrays', () => {
      expect(canonicalStringify([])).toBe('[]');
    });

    it('handles nested arrays', () => {
      expect(canonicalStringify([[1, 2], [3]])).toBe('[[1,2],[3]]');
    });
  });

  describe('plain objects', () => {
    it('sorts keys', () => {
      expect(canonicalStringify({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
    });

    it('produces the same key for objects that differ only in key order', () => {
      expect(canonicalStringify({ a: 1, b: 2 })).toBe(canonicalStringify({ b: 2, a: 1 }));
      expect(canonicalStringify({ x: { a: 1, b: 2 }, y: 3 })).toBe(
        canonicalStringify({ y: 3, x: { b: 2, a: 1 } }),
      );
    });

    it('handles empty objects', () => {
      expect(canonicalStringify({})).toBe('{}');
    });

    it('quotes keys via JSON.stringify so special characters are stable', () => {
      expect(canonicalStringify({ 'with space': 1 })).toBe('{"with space":1}');
      expect(canonicalStringify({ 'with"quote': 1 })).toBe('{"with\\"quote":1}');
    });

    it('distinguishes objects with different values', () => {
      expect(canonicalStringify({ a: 1 })).not.toBe(canonicalStringify({ a: 2 }));
    });

    it('distinguishes between absent and undefined keys', () => {
      expect(canonicalStringify({ a: 1 })).not.toBe(canonicalStringify({ a: 1, b: undefined }));
    });
  });

  describe('nested structures', () => {
    it('canonicalizes recursively', () => {
      const value = {
        name: 'Alice',
        tags: ['admin', 'staff'],
        meta: { joined: new Date('2026-01-01T00:00:00.000Z'), id: 42n },
      };
      const reordered = {
        meta: { id: 42n, joined: new Date('2026-01-01T00:00:00.000Z') },
        tags: ['admin', 'staff'],
        name: 'Alice',
      };
      expect(canonicalStringify(value)).toBe(canonicalStringify(reordered));
    });

    it('discriminates on any nested change', () => {
      const a = { user: { name: 'Alice', age: 30 } };
      const b = { user: { name: 'Alice', age: 31 } };
      expect(canonicalStringify(a)).not.toBe(canonicalStringify(b));
    });
  });

  describe('determinism', () => {
    it('produces the same output across repeated calls', () => {
      const value = {
        a: 1,
        b: [2, 3, { c: 'x' }],
        d: new Date('2026-04-27T00:00:00.000Z'),
        e: 100n,
      };
      const first = canonicalStringify(value);
      const second = canonicalStringify(value);
      const third = canonicalStringify(value);
      expect(first).toBe(second);
      expect(second).toBe(third);
    });
  });

  describe('rejected inputs', () => {
    it('throws on functions', () => {
      expect(() => canonicalStringify(() => 1)).toThrow(TypeError);
      expect(() => canonicalStringify({ fn: () => 1 })).toThrow(TypeError);
    });

    it('throws on symbols', () => {
      expect(() => canonicalStringify(Symbol('x'))).toThrow(TypeError);
      expect(() => canonicalStringify({ s: Symbol('x') })).toThrow(TypeError);
    });

    it('throws on circular references', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj['self'] = obj;
      expect(() => canonicalStringify(obj)).toThrow(/circular/i);
    });

    it('throws on circular references through arrays', () => {
      const arr: unknown[] = [1];
      arr.push(arr);
      expect(() => canonicalStringify(arr)).toThrow(/circular/i);
    });

    it('does not flag siblings sharing a reference as circular', () => {
      const shared = { x: 1 };
      const value = { a: shared, b: shared };
      expect(() => canonicalStringify(value)).not.toThrow();
      expect(canonicalStringify(value)).toBe('{"a":{"x":1},"b":{"x":1}}');
    });

    it('throws on Map (would otherwise collapse to {})', () => {
      expect(() => canonicalStringify(new Map([['a', 1]]))).toThrow(/non-plain objects/i);
    });

    it('throws on Set (would otherwise collapse to {})', () => {
      expect(() => canonicalStringify(new Set([1, 2, 3]))).toThrow(/non-plain objects/i);
    });

    it('throws on RegExp (would otherwise collapse to {})', () => {
      expect(() => canonicalStringify(/foo/)).toThrow(/non-plain objects/i);
    });

    it('throws on class instances (would otherwise collapse to a same-keyed plain object)', () => {
      class Point {
        constructor(
          public x: number,
          public y: number,
        ) {}
        distance() {
          return Math.hypot(this.x, this.y);
        }
      }
      expect(() => canonicalStringify(new Point(1, 2))).toThrow(/non-plain objects/i);
    });

    it('does not collide a Map and a Set (both would have been {})', () => {
      // Sanity check: each is rejected individually; the point of rejection
      // is precisely that they are otherwise indistinguishable.
      expect(() => canonicalStringify(new Map())).toThrow();
      expect(() => canonicalStringify(new Set())).toThrow();
    });

    it('throws on objects with symbol-keyed properties (would silently drop them)', () => {
      const sym = Symbol('hidden');
      expect(() => canonicalStringify({ [sym]: 1 })).toThrow(/symbol-keyed/i);
      expect(() => canonicalStringify({ a: 1, [sym]: 2 })).toThrow(/symbol-keyed/i);
    });

    it('still accepts prototype-less plain objects', () => {
      const obj = Object.create(null) as Record<string, unknown>;
      obj['a'] = 1;
      obj['b'] = 2;
      expect(canonicalStringify(obj)).toBe('{"a":1,"b":2}');
    });
  });
});
