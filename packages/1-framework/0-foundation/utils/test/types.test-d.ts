import { expectTypeOf, test } from 'vitest';
import type { Simplify, UnionToIntersection } from '../src/types';

test('Simplify flattens an intersection into a single object type', () => {
  type Input = { a: number } & { b: string };
  expectTypeOf<Simplify<Input>>().toEqualTypeOf<{ a: number; b: string }>();
});

test('Simplify preserves optional modifiers', () => {
  type Input = { a: number } & { b?: string };
  expectTypeOf<Simplify<Input>>().toEqualTypeOf<{ a: number; b?: string }>();
});

test('UnionToIntersection collapses a union of objects into their intersection', () => {
  type Input = { a: number } | { b: string };
  expectTypeOf<UnionToIntersection<Input>>().toEqualTypeOf<{ a: number } & { b: string }>();
});
