import type { CodecInstanceContext } from '@prisma-next/framework-components/codec';
import type { SqlCharCodec, SqlTimestampCodec } from '@prisma-next/sql-relational-core/ast';
import { expectTypeOf, test } from 'vitest';
import type {
  AnyPostgresCodecDescriptor,
  PostgresCodecDescriptorRegistry,
} from '../src/core/codec-descriptor';
import { codecDescriptorMap } from '../src/core/codec-type-map';
import {
  codecDescriptors,
  type PgBitCodec,
  type PgInt4Codec,
  pgBitColumn,
  type pgDateDescriptor,
  pgInt4Column,
  pgInt4Descriptor,
  postgresSqlCharDescriptor,
  postgresSqlTimestampDescriptor,
} from '../src/core/codecs';
import { postgresCodecDescriptorRegistry } from '../src/core/registry';

test('canonical descriptors are target-typed without losing tuple membership', () => {
  expectTypeOf(codecDescriptors).toExtend<readonly AnyPostgresCodecDescriptor[]>();
  expectTypeOf<(typeof codecDescriptors)[number]>().toExtend<AnyPostgresCodecDescriptor>();
});

test('generic adapters preserve factory result types', () => {
  expectTypeOf(postgresSqlCharDescriptor.factory({ length: 12 })).toEqualTypeOf<
    (ctx: CodecInstanceContext) => SqlCharCodec
  >();
  expectTypeOf(postgresSqlTimestampDescriptor.factory({ precision: 3 })).toEqualTypeOf<
    (ctx: CodecInstanceContext) => SqlTimestampCodec
  >();
});

test('target descriptors preserve existing factory and column-helper results', () => {
  expectTypeOf(pgInt4Descriptor.factory()).toEqualTypeOf<
    (ctx: CodecInstanceContext) => PgInt4Codec
  >();
  expectTypeOf(pgInt4Column().codecFactory).toEqualTypeOf<
    (ctx: CodecInstanceContext) => PgInt4Codec
  >();
  expectTypeOf(pgBitColumn({ length: 8 }).codecFactory).toEqualTypeOf<
    (ctx: CodecInstanceContext) => PgBitCodec
  >();
});

test('typed registry exposes only PostgreSQL descriptors', () => {
  expectTypeOf(postgresCodecDescriptorRegistry).toEqualTypeOf<PostgresCodecDescriptorRegistry>();
  expectTypeOf(postgresCodecDescriptorRegistry.descriptorFor('pg/int4@1')).toEqualTypeOf<
    AnyPostgresCodecDescriptor | undefined
  >();
});

test('emitted descriptor map keeps generic adapters and intentional omissions', () => {
  expectTypeOf(codecDescriptorMap.char).toExtend<AnyPostgresCodecDescriptor>();
  expectTypeOf(codecDescriptorMap['sql-timestamp']).toExtend<AnyPostgresCodecDescriptor>();
  expectTypeOf(codecDescriptorMap.int4).toEqualTypeOf<typeof pgInt4Descriptor>();
  expectTypeOf(codecDescriptorMap.date).toEqualTypeOf<typeof pgDateDescriptor>();

  // @ts-expect-error -- pg/text-array@1 remains runtime-only in the emitted type map
  codecDescriptorMap['text-array'];
});
