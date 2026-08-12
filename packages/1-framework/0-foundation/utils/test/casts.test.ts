import { describe, expect, expectTypeOf, it } from 'vitest';
import { blindCast, castAs } from '../src/casts';

describe('blindCast', () => {
  it('returns the input unchanged at runtime', () => {
    const input: unknown = { a: 1 };
    const result = blindCast<{ a: number }, 'unit test'>(input);
    expect(result).toBe(input);
  });

  it('returns primitive inputs unchanged', () => {
    expect(blindCast<string, 'unit test'>('hello')).toBe('hello');
    expect(blindCast<number, 'unit test'>(42)).toBe(42);
    expect(blindCast<boolean, 'unit test'>(true)).toBe(true);
  });

  it('returns null and undefined unchanged', () => {
    expect(blindCast<null, 'unit test'>(null)).toBeNull();
    expect(blindCast<undefined, 'unit test'>(undefined)).toBeUndefined();
  });

  it('preserves object identity (does not clone or freeze)', () => {
    const input = { nested: { value: 1 } };
    const result = blindCast<{ nested: { value: number } }, 'unit test'>(input);
    expect(result).toBe(input);
    expect(result.nested).toBe(input.nested);
    expect(Object.isFrozen(result)).toBe(false);
  });

  it('produces a value of the requested target type', () => {
    const result = blindCast<{ a: number }, 'unit test'>({ a: 1 } as unknown);
    expectTypeOf(result).toEqualTypeOf<{ a: number }>();
  });

  it('requires a string-literal Reason at the call site', () => {
    const result = blindCast<string, 'demonstrating the reason literal'>('value');
    expect(result).toBe('value');
  });
});

describe('castAs', () => {
  it('returns the value unchanged at runtime', () => {
    const input = { a: 1 };
    const result = castAs<{ a: number }>(input);
    expect(result).toBe(input);
  });

  it('returns primitive inputs unchanged', () => {
    expect(castAs<string>('hello')).toBe('hello');
    expect(castAs<number>(42)).toBe(42);
    expect(castAs<boolean>(true)).toBe(true);
  });

  it('preserves object identity (does not clone or freeze)', () => {
    const input = { nested: { value: 1 } };
    const result = castAs<{ nested: { value: number } }>(input);
    expect(result).toBe(input);
    expect(result.nested).toBe(input.nested);
    expect(Object.isFrozen(result)).toBe(false);
  });

  it('narrows the result type to the requested type parameter', () => {
    const wide: string | number = 'hello' as string | number;
    const result = castAs<string | number>(wide);
    expectTypeOf(result).toEqualTypeOf<string | number>();
  });

  it('requires the value to be assignable to the target type', () => {
    const obj: { key: string; subKey: number } = { key: 'value', subKey: 2 };
    const result = castAs<{ key: string; subKey: number }>(obj);
    expectTypeOf(result).toEqualTypeOf<{ key: string; subKey: number }>();
    expect(result).toEqual({ key: 'value', subKey: 2 });
  });
});
