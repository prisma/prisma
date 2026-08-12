import { describe, expect, it } from 'vitest';
import { type NotOk, notOk, type Ok, ok, okVoid } from '../src/result';

describe('result', () => {
  describe('ok()', () => {
    it('creates a successful result with a value', () => {
      const result = ok(42);
      expect(result).toMatchObject({ ok: true, value: 42 });
    });

    it('creates a frozen result', () => {
      const result = ok('test');
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('notOk()', () => {
    it('creates an unsuccessful result with failure details', () => {
      const result = notOk({ code: 'ERR_TEST', message: 'Test error' });
      expect(result).toMatchObject({
        ok: false,
        failure: { code: 'ERR_TEST', message: 'Test error' },
      });
    });

    it('creates a frozen result', () => {
      const result = notOk('error');
      expect(Object.isFrozen(result)).toBe(true);
    });
  });

  describe('okVoid()', () => {
    it('returns a successful void result', () => {
      const result = okVoid();
      expect(result.ok).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('returns the same singleton instance', () => {
      const result1 = okVoid();
      const result2 = okVoid();
      expect(result1).toBe(result2);
    });
  });

  describe('assertOk()', () => {
    it('returns the value for Ok results', () => {
      const result = ok(42);
      expect(result.assertOk()).toBe(42);
    });

    it('throws for NotOk results', () => {
      const result = notOk('error');
      expect(() => result.assertOk()).toThrow('Expected Ok result but got NotOk');
    });
  });

  describe('assertNotOk()', () => {
    it('returns the failure for NotOk results', () => {
      const result = notOk({ code: 'ERR_TEST' });
      expect(result.assertNotOk()).toEqual({ code: 'ERR_TEST' });
    });

    it('throws for Ok results', () => {
      const result = ok(42);
      expect(() => result.assertNotOk()).toThrow('Expected NotOk result but got Ok');
    });
  });

  describe('property access', () => {
    it('allows accessing value on Ok results', () => {
      const result = ok(42);
      expect(result.value).toBe(42);
    });

    it('throws when accessing failure on Ok results', () => {
      const result = ok(42);
      expect(() => (result as unknown as NotOk<number>).failure).toThrow(
        'Cannot access failure on Ok result',
      );
    });

    it('allows accessing failure on NotOk results', () => {
      const result = notOk('error');
      expect(result.failure).toBe('error');
    });

    it('throws when accessing value on NotOk results', () => {
      const result = notOk('error');
      expect(() => (result as unknown as Ok<number>).value).toThrow(
        'Cannot access value on NotOk result',
      );
    });
  });
});
