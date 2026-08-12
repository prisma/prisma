import { describe, expect, it } from 'vitest';
import { postgresRawCodecInferer } from '../src/core/adapter';

const adapter = postgresRawCodecInferer;

describe('inferCodec', () => {
  describe('number → pg/int4 or pg/float8', () => {
    it('maps a safe integer to pg/int4', () => {
      expect(adapter.inferCodec(42)).toBe('pg/int4');
    });

    it('maps zero to pg/int4', () => {
      expect(adapter.inferCodec(0)).toBe('pg/int4');
    });

    it('maps negative zero to pg/int4', () => {
      expect(adapter.inferCodec(-0)).toBe('pg/int4');
    });

    it('maps a fractional number to pg/float8', () => {
      expect(adapter.inferCodec(1.5)).toBe('pg/float8');
    });

    it('maps a value above MAX_SAFE_INTEGER to pg/float8 to avoid silent truncation', () => {
      expect(adapter.inferCodec(Number.MAX_SAFE_INTEGER + 1)).toBe('pg/float8');
    });
  });

  describe('bigint → pg/int8', () => {
    it('maps a bigint literal to pg/int8', () => {
      expect(adapter.inferCodec(1n)).toBe('pg/int8');
    });
  });

  describe('string → pg/text', () => {
    it('maps a non-empty string to pg/text', () => {
      expect(adapter.inferCodec('hello')).toBe('pg/text');
    });

    it('maps an empty string to pg/text', () => {
      expect(adapter.inferCodec('')).toBe('pg/text');
    });
  });

  describe('boolean → pg/bool', () => {
    it('maps true to pg/bool', () => {
      expect(adapter.inferCodec(true)).toBe('pg/bool');
    });

    it('maps false to pg/bool', () => {
      expect(adapter.inferCodec(false)).toBe('pg/bool');
    });
  });

  describe('Uint8Array → pg/bytea', () => {
    it('maps a non-empty Uint8Array to pg/bytea', () => {
      expect(adapter.inferCodec(new Uint8Array([1, 2, 3]))).toBe('pg/bytea');
    });

    it('maps an empty Uint8Array to pg/bytea', () => {
      expect(adapter.inferCodec(new Uint8Array([]))).toBe('pg/bytea');
    });
  });

  describe('defence-in-depth throw for unsupported types', () => {
    const throwMsg = 'wrap this value in `param(...)` with an explicit codec';
    // Cast to a wider shape so TypeScript does not prevent passing unsupported
    // values — the purpose of these tests is to exercise the runtime guard.
    const unchecked = adapter as unknown as { inferCodec(v: unknown): string };

    it('throws for Date', () => {
      expect(() => unchecked.inferCodec(new Date())).toThrow(throwMsg);
    });

    it('throws for null', () => {
      expect(() => unchecked.inferCodec(null)).toThrow(throwMsg);
    });

    it('throws for undefined', () => {
      expect(() => unchecked.inferCodec(undefined)).toThrow(throwMsg);
    });

    it('throws for a plain object', () => {
      expect(() => unchecked.inferCodec({ foo: 1 })).toThrow(throwMsg);
    });

    it('throws for an array', () => {
      expect(() => unchecked.inferCodec([1, 2])).toThrow(throwMsg);
    });
  });
});
