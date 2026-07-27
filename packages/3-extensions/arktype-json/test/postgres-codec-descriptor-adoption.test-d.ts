import type { CodecInstanceContext } from '@prisma-next/framework-components/codec';
import type { AnyPostgresCodecDescriptor } from '@prisma-next/target-postgres/codec-descriptor';
import { type } from 'arktype';
import { expectTypeOf, test } from 'vitest';
import {
  type ArktypeJsonCodecClass,
  type ArktypeJsonDescriptor,
  arktypeJsonColumn,
  arktypeJsonDescriptor,
  codecDescriptors,
} from '../src/core/arktype-json-codec';

test('arktype-json canonical descriptors are PostgreSQL target descriptors', () => {
  expectTypeOf(codecDescriptors).toExtend<readonly AnyPostgresCodecDescriptor[]>();
  expectTypeOf<(typeof codecDescriptors)[number]>().toEqualTypeOf<ArktypeJsonDescriptor>();
});

test('arktype-json preserves descriptor erasure and column-site schema inference', () => {
  const schema = type({ name: 'string', price: 'number' });
  const column = arktypeJsonColumn(schema);

  expectTypeOf(arktypeJsonDescriptor.factory(column.typeParams)).toEqualTypeOf<
    (ctx: CodecInstanceContext) => ArktypeJsonCodecClass<unknown>
  >();
  expectTypeOf(column.codecFactory).toEqualTypeOf<
    (ctx: CodecInstanceContext) => ArktypeJsonCodecClass<{ name: string; price: number }>
  >();
});
