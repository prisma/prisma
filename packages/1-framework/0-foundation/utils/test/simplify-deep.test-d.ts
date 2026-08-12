import { describe, expectTypeOf, test } from 'vitest';
import type { SimplifyDeep } from '../src/simplify-deep';

describe('SimplifyDeep', () => {
  test('primitives pass through', () => {
    expectTypeOf<SimplifyDeep<string>>().toEqualTypeOf<string>();
    expectTypeOf<SimplifyDeep<number>>().toEqualTypeOf<number>();
    expectTypeOf<SimplifyDeep<boolean>>().toEqualTypeOf<boolean>();
    expectTypeOf<SimplifyDeep<bigint>>().toEqualTypeOf<bigint>();
    expectTypeOf<SimplifyDeep<symbol>>().toEqualTypeOf<symbol>();
    expectTypeOf<SimplifyDeep<null>>().toEqualTypeOf<null>();
    expectTypeOf<SimplifyDeep<undefined>>().toEqualTypeOf<undefined>();
    expectTypeOf<SimplifyDeep<unknown>>().toEqualTypeOf<unknown>();
    expectTypeOf<SimplifyDeep<never>>().toEqualTypeOf<never>();
  });

  test('branded primitives pass through', () => {
    type Branded = string & { readonly __brand: true };
    expectTypeOf<SimplifyDeep<Branded>>().toEqualTypeOf<Branded>();
  });

  test('Date, RegExp, and Uint8Array preserved', () => {
    expectTypeOf<SimplifyDeep<Date>>().toEqualTypeOf<Date>();
    expectTypeOf<SimplifyDeep<RegExp>>().toEqualTypeOf<RegExp>();
    expectTypeOf<SimplifyDeep<Uint8Array>>().toEqualTypeOf<Uint8Array>();
  });

  test('functions preserved', () => {
    type Fn = (a: number, b: string) => boolean;
    expectTypeOf<SimplifyDeep<Fn>>().toEqualTypeOf<Fn>();
  });

  test('intersections flatten into plain objects', () => {
    type Input = { a: number } & { b: string };
    type Expected = { a: number; b: string };
    expectTypeOf<SimplifyDeep<Input>>().toEqualTypeOf<Expected>();
  });

  test('mutable arrays recurse', () => {
    type Input = ({ a: number } & { b: string })[];
    type Expected = { a: number; b: string }[];
    expectTypeOf<SimplifyDeep<Input>>().toEqualTypeOf<Expected>();
  });

  test('readonly arrays preserve readonly', () => {
    type Input = readonly ({ a: number } & { b: string })[];
    type Expected = readonly { a: number; b: string }[];
    expectTypeOf<SimplifyDeep<Input>>().toEqualTypeOf<Expected>();
  });

  test('nested objects recurse', () => {
    type Input = { nested: { a: number } & { b: string } };
    type Expected = { nested: { a: number; b: string } };
    expectTypeOf<SimplifyDeep<Input>>().toEqualTypeOf<Expected>();
  });

  test('nullable objects', () => {
    type Input = ({ a: number } & { b: string }) | null;
    type Expected = { a: number; b: string } | null;
    expectTypeOf<SimplifyDeep<Input>>().toEqualTypeOf<Expected>();
  });

  test('nested arrays of intersected objects', () => {
    type Input = {
      items: ({ id: number } & { name: string })[];
    };
    type Expected = {
      items: { id: number; name: string }[];
    };
    expectTypeOf<SimplifyDeep<Input>>().toEqualTypeOf<Expected>();
  });

  test('bidirectional assignability for concrete types', () => {
    type Original = { a: number } & { b: string; nested: { c: boolean } & { d: number } };
    type Simplified = SimplifyDeep<Original>;

    expectTypeOf<Original>().toExtend<Simplified>();
    expectTypeOf<Simplified>().toExtend<Original>();
  });
});
