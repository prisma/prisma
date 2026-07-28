import type { CodecInstanceContext } from '@prisma-next/framework-components/codec';
import type { AnyPostgresCodecDescriptor } from '@prisma-next/target-postgres/codec-descriptor';
import { expectTypeOf, test } from 'vitest';
import {
  codecDescriptors,
  type PgVectorCodec,
  type PgVectorDescriptor,
  pgVectorColumn,
  pgVectorDescriptor,
} from '../src/core/codecs';
import type { CodecTypes } from '../src/exports/codec-types';

test('pgvector canonical descriptors are PostgreSQL target descriptors', () => {
  expectTypeOf(codecDescriptors).toExtend<readonly AnyPostgresCodecDescriptor[]>();
  expectTypeOf<(typeof codecDescriptors)[number]>().toEqualTypeOf<PgVectorDescriptor>();
});

test('pgvector factory and column dimension types remain exact', () => {
  expectTypeOf(pgVectorDescriptor.factory({ length: 3 })).toEqualTypeOf<
    (ctx: CodecInstanceContext) => PgVectorCodec
  >();
  expectTypeOf(pgVectorColumn(3).typeParams).toExtend<{ readonly length: 3 }>();
  expectTypeOf<CodecTypes['pg/vector@1']['input']>().toEqualTypeOf<number[]>();
  expectTypeOf<CodecTypes['pg/vector@1']['output']>().toEqualTypeOf<number[]>();
});
