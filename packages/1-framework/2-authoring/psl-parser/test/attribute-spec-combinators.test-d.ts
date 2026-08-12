import { expectTypeOf, test } from 'vitest';
import type { ArgType } from '../src/exports';
import { identifier, list, oneOf, str } from '../src/exports';

test('identifier pins its name as the output literal type', () => {
  expectTypeOf(identifier('NoAction')).toEqualTypeOf<ArgType<'NoAction'>>();
});

test('oneOf infers the union of its alternatives output types', () => {
  expectTypeOf(oneOf(identifier('NoAction'), identifier('Cascade'))).toEqualTypeOf<
    ArgType<'NoAction' | 'Cascade'>
  >();
});

test('oneOf with no alternatives is a compile error', () => {
  // @ts-expect-error oneOf requires at least one alternative
  oneOf();
});

test('list infers an array of its element type', () => {
  expectTypeOf(list(str())).toEqualTypeOf<ArgType<string[]>>();
});
