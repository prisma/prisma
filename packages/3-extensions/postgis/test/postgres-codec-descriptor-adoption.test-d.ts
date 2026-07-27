import type { CodecInstanceContext } from '@prisma-next/framework-components/codec';
import type { AnyPostgresCodecDescriptor } from '@prisma-next/target-postgres/codec-descriptor';
import { expectTypeOf, test } from 'vitest';
import {
  codecDescriptors,
  type PostgisGeometryCodec,
  type PostgisGeometryDescriptor,
  pgGeometryColumn,
  postgisGeometryDescriptor,
} from '../src/core/codecs';
import type { Geometry } from '../src/core/geojson';
import type { CodecTypes } from '../src/exports/codec-types';
import { geometry, geometryColumn } from '../src/exports/column-types';

test('PostGIS canonical descriptors are PostgreSQL target descriptors', () => {
  expectTypeOf(codecDescriptors).toExtend<readonly AnyPostgresCodecDescriptor[]>();
  expectTypeOf<(typeof codecDescriptors)[number]>().toEqualTypeOf<PostgisGeometryDescriptor>();
});

test('PostGIS factory, column, and application types remain exact', () => {
  expectTypeOf(postgisGeometryDescriptor.factory({ srid: 4326 })).toEqualTypeOf<
    (ctx: CodecInstanceContext) => PostgisGeometryCodec
  >();
  expectTypeOf(pgGeometryColumn({ srid: 4326 }).typeParams).toExtend<{
    readonly srid: 4326;
  }>();
  expectTypeOf(geometry({ srid: 4326 }).typeParams).toExtend<{
    readonly srid: 4326;
  }>();
  expectTypeOf(geometryColumn).not.toHaveProperty('typeParams');
  expectTypeOf<CodecTypes['pg/geometry@1']['input']>().toEqualTypeOf<Geometry>();
  expectTypeOf<CodecTypes['pg/geometry@1']['output']>().toEqualTypeOf<Geometry>();
});
