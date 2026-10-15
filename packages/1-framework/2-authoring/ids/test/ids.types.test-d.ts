import { expectTypeOf, test } from 'vitest';
import { cuid2, ksuid, nanoid, ulid, uuidv4, uuidv7 } from '../src/index';

test('each generator spec types the length of the column it bundles', () => {
  expectTypeOf(ulid().typeParams).toEqualTypeOf<{ readonly length: 26 }>();
  expectTypeOf(uuidv4().typeParams).toEqualTypeOf<{ readonly length: 36 }>();
  expectTypeOf(uuidv7().typeParams).toEqualTypeOf<{ readonly length: 36 }>();
  expectTypeOf(cuid2().typeParams).toEqualTypeOf<{ readonly length: 24 }>();
  expectTypeOf(ksuid().typeParams).toEqualTypeOf<{ readonly length: 27 }>();
  expectTypeOf(nanoid().typeParams).toEqualTypeOf<{ readonly length: 21 }>();
});

test('nanoid types the length from a literal size', () => {
  expectTypeOf(nanoid({ size: 12 }).typeParams).toEqualTypeOf<{ readonly length: 12 }>();
});

test('nanoid does not claim a length for a size it cannot know', () => {
  const options: { size?: number } = {};
  expectTypeOf(nanoid(options).typeParams).toEqualTypeOf<{ readonly length: number }>();
  const size: number = 12;
  expectTypeOf(nanoid({ size }).typeParams).toEqualTypeOf<{ readonly length: number }>();
});
