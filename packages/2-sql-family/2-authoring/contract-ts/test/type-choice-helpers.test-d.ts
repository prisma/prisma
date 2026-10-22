import { expectTypeOf, test } from 'vitest';
import { testTypeLookups } from '../../../1-core/contract/test/test-type-lookups';
import { createComposedAuthoringHelpers } from '../src/composed-authoring-helpers';
import { familyPack, targetPack } from './helpers/type-choice-packs';

const { type } = createComposedAuthoringHelpers({
  ...testTypeLookups,
  family: familyPack,
  target: targetPack,
});

test('a bare call resolves to the default row, with its parameter defaults', () => {
  expectTypeOf(type.Moment()).toEqualTypeOf(type.TimestamptzTemporal(3));
  expectTypeOf(type.Moment().codecId).toEqualTypeOf<'pg/timestamptz-temporal@1'>();
});

test('a written precision replaces the row default', () => {
  expectTypeOf(type.Moment('temporal', 'tz', 6)).toEqualTypeOf(type.TimestamptzTemporal(6));
});

test('each row resolves to the type it names', () => {
  expectTypeOf(type.Moment('temporal', 'local')).toEqualTypeOf(type.TimestampTemporal());
  expectTypeOf(type.Moment('temporal', 'local', 6)).toEqualTypeOf(type.TimestampTemporal(6));
  expectTypeOf(type.Moment('string', 'local')).toEqualTypeOf(type.TimestampString());
  expectTypeOf(type.Day()).toEqualTypeOf(type.DateString());
  expectTypeOf(type.Day('temporal')).toEqualTypeOf(type.DateTemporal());
});

test('an option argument takes only the values it lists', () => {
  // @ts-expect-error Moment's value is temporal or string
  type.Moment('jsDate');
});

test('an unlisted combination does not compile', () => {
  // @ts-expect-error value: string chooses no type with the default column tz
  type.Moment('string');
  // @ts-expect-error DateString takes no precision
  type.Day('string', 3);
});
