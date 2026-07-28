import type { AnyCodecDescriptor, CodecRef } from '@prisma-next/framework-components/codec';
import {
  CastExpr,
  ColumnRef,
  FunctionCallExpr,
  LiteralExpr,
  sqlCharDescriptor,
  sqlFloatDescriptor,
  sqlIntDescriptor,
  sqlTextDescriptor,
  sqlTimestampDescriptor,
  sqlVarcharDescriptor,
} from '@prisma-next/sql-relational-core/ast';
import { ifDefined } from '@prisma-next/utils/defined';
import { describe, expect, it } from 'vitest';
import type { AnyPostgresCodecDescriptor } from '../src/core/codec-descriptor';
import { codecDescriptorMap } from '../src/core/codec-type-map';
import {
  codecDescriptors,
  pgBitDescriptor,
  pgBoolDescriptor,
  pgByteaDescriptor,
  pgCharDescriptor,
  pgDateDescriptor,
  pgEnumDescriptor,
  pgFloat4Descriptor,
  pgFloat8Descriptor,
  pgFloatDescriptor,
  pgInetDescriptor,
  pgInt2Descriptor,
  pgInt4Descriptor,
  pgInt8Descriptor,
  pgIntDescriptor,
  pgIntervalDescriptor,
  pgJsonbDescriptor,
  pgJsonDescriptor,
  pgNumericDescriptor,
  pgTextArrayDescriptor,
  pgTextDescriptor,
  pgTimeDescriptor,
  pgTimestampDescriptor,
  pgTimestamptzDescriptor,
  pgTimetzDescriptor,
  pgUuidDescriptor,
  pgVarbitDescriptor,
  pgVarcharDescriptor,
  postgresSqlCharDescriptor,
  postgresSqlFloatDescriptor,
  postgresSqlIntDescriptor,
  postgresSqlTextDescriptor,
  postgresSqlTimestampDescriptor,
  postgresSqlVarcharDescriptor,
} from '../src/core/codecs';
import { postgresCodecDescriptorRegistry, postgresCodecRegistry } from '../src/core/registry';

const EXPECTED_CODEC_IDS = [
  'sql/char@1',
  'sql/varchar@1',
  'sql/int@1',
  'sql/float@1',
  'sql/text@1',
  'sql/timestamp@1',
  'pg/text@1',
  'pg/enum@1',
  'pg/char@1',
  'pg/varchar@1',
  'pg/int@1',
  'pg/float@1',
  'pg/int4@1',
  'pg/int2@1',
  'pg/int8@1',
  'pg/float4@1',
  'pg/float8@1',
  'pg/numeric@1',
  'pg/date@1',
  'pg/timestamp@1',
  'pg/timestamptz@1',
  'pg/time@1',
  'pg/timetz@1',
  'pg/bool@1',
  'pg/bit@1',
  'pg/varbit@1',
  'pg/bytea@1',
  'pg/uuid@1',
  'pg/inet@1',
  'pg/interval@1',
  'pg/json@1',
  'pg/jsonb@1',
  'pg/text-array@1',
] as const;

const refFor = (
  descriptor: AnyPostgresCodecDescriptor,
  typeParams?: CodecRef['typeParams'],
): CodecRef => ({
  codecId: descriptor.codecId,
  ...ifDefined('typeParams', typeParams),
});

const metaNativeType = (
  descriptor: AnyPostgresCodecDescriptor,
  typeParams?: CodecRef['typeParams'],
): string | undefined => {
  const meta = descriptor.metaFor?.(typeParams) ?? descriptor.meta;
  const sql = meta?.db?.['sql'];
  if (typeof sql !== 'object' || sql === null || !('postgres' in sql)) return undefined;
  const postgres = sql.postgres;
  if (typeof postgres !== 'object' || postgres === null || !('nativeType' in postgres)) {
    return undefined;
  }
  return typeof postgres.nativeType === 'string' ? postgres.nativeType : undefined;
};

describe('PostgreSQL built-in codec descriptors', () => {
  it('keeps the complete canonical order with only target descriptors', () => {
    expect(codecDescriptors.map((descriptor) => descriptor.codecId)).toEqual(EXPECTED_CODEC_IDS);
    expect(
      codecDescriptors.every((descriptor) => descriptor.descriptorKind === 'postgres-codec'),
    ).toBe(true);

    for (const rawDescriptor of [
      sqlCharDescriptor,
      sqlVarcharDescriptor,
      sqlIntDescriptor,
      sqlFloatDescriptor,
      sqlTextDescriptor,
      sqlTimestampDescriptor,
    ]) {
      expect(codecDescriptors).not.toContain(rawDescriptor);
    }
  });

  it('adapts every generic SQL descriptor with current PostgreSQL native types', () => {
    const expression = ColumnRef.of('records', 'value');
    const cases: ReadonlyArray<{
      descriptor: AnyPostgresCodecDescriptor;
      rawDescriptor: AnyCodecDescriptor;
      nativeType: string;
      typeParams?: CodecRef['typeParams'];
    }> = [
      {
        descriptor: postgresSqlCharDescriptor,
        rawDescriptor: sqlCharDescriptor,
        nativeType: 'character',
        typeParams: { length: 12 },
      },
      {
        descriptor: postgresSqlVarcharDescriptor,
        rawDescriptor: sqlVarcharDescriptor,
        nativeType: 'character varying',
        typeParams: { length: 120 },
      },
      {
        descriptor: postgresSqlIntDescriptor,
        rawDescriptor: sqlIntDescriptor,
        nativeType: 'int4',
      },
      {
        descriptor: postgresSqlFloatDescriptor,
        rawDescriptor: sqlFloatDescriptor,
        nativeType: 'float8',
      },
      {
        descriptor: postgresSqlTextDescriptor,
        rawDescriptor: sqlTextDescriptor,
        nativeType: 'text',
      },
      {
        descriptor: postgresSqlTimestampDescriptor,
        rawDescriptor: sqlTimestampDescriptor,
        nativeType: 'timestamp',
        typeParams: { precision: 3 },
      },
    ];

    for (const { descriptor, rawDescriptor, nativeType, typeParams } of cases) {
      expect(descriptor.codecId).toBe(rawDescriptor.codecId);
      expect(descriptor.paramsSchema).toBe(rawDescriptor.paramsSchema);
      expect(descriptor.nativeTypeFor(refFor(descriptor, typeParams))).toBe(nativeType);
      expect(descriptor.projectJson(expression, refFor(descriptor, typeParams))).toBe(expression);
    }
  });

  it('preserves target metadata while exposing matching native-type behavior', () => {
    const expression = ColumnRef.of('records', 'value');
    const cases: ReadonlyArray<{
      descriptor: AnyPostgresCodecDescriptor;
      nativeType: string;
      typeParams?: CodecRef['typeParams'];
      /** Codecs whose projection replaces the database's own JSON conversion rather than accepting it. */
      jsonProjection?: 'decimal-text' | 'base64' | 'utc-iso';
    }> = [
      { descriptor: pgTextDescriptor, nativeType: 'text' },
      {
        descriptor: pgEnumDescriptor,
        nativeType: 'auth.status',
        typeParams: { typeName: 'auth.status' },
      },
      { descriptor: pgCharDescriptor, nativeType: 'character', typeParams: { length: 12 } },
      {
        descriptor: pgVarcharDescriptor,
        nativeType: 'character varying',
        typeParams: { length: 120 },
      },
      { descriptor: pgIntDescriptor, nativeType: 'integer' },
      { descriptor: pgFloatDescriptor, nativeType: 'double precision' },
      { descriptor: pgInt4Descriptor, nativeType: 'integer' },
      { descriptor: pgInt2Descriptor, nativeType: 'smallint' },
      { descriptor: pgInt8Descriptor, nativeType: 'bigint', jsonProjection: 'decimal-text' },
      { descriptor: pgFloat4Descriptor, nativeType: 'real' },
      { descriptor: pgFloat8Descriptor, nativeType: 'double precision' },
      {
        descriptor: pgNumericDescriptor,
        nativeType: 'numeric',
        typeParams: {},
        jsonProjection: 'decimal-text',
      },
      { descriptor: pgDateDescriptor, nativeType: 'date' },
      {
        descriptor: pgTimestampDescriptor,
        nativeType: 'timestamp without time zone',
        typeParams: { precision: 3 },
      },
      {
        descriptor: pgTimestamptzDescriptor,
        nativeType: 'timestamp with time zone',
        typeParams: { precision: 3 },
        jsonProjection: 'utc-iso',
      },
      { descriptor: pgTimeDescriptor, nativeType: 'time', typeParams: { precision: 3 } },
      { descriptor: pgTimetzDescriptor, nativeType: 'timetz', typeParams: { precision: 3 } },
      { descriptor: pgBoolDescriptor, nativeType: 'boolean' },
      { descriptor: pgBitDescriptor, nativeType: 'bit', typeParams: { length: 8 } },
      { descriptor: pgVarbitDescriptor, nativeType: 'bit varying', typeParams: { length: 8 } },
      { descriptor: pgByteaDescriptor, nativeType: 'bytea', jsonProjection: 'base64' },
      { descriptor: pgUuidDescriptor, nativeType: 'uuid' },
      { descriptor: pgInetDescriptor, nativeType: 'inet' },
      { descriptor: pgIntervalDescriptor, nativeType: 'interval', typeParams: {} },
      { descriptor: pgJsonDescriptor, nativeType: 'json' },
      { descriptor: pgJsonbDescriptor, nativeType: 'jsonb' },
      { descriptor: pgTextArrayDescriptor, nativeType: 'text[]' },
    ];

    for (const { descriptor, nativeType, typeParams, jsonProjection } of cases) {
      const ref = refFor(descriptor, typeParams);
      expect(descriptor.nativeTypeFor(ref)).toBe(nativeType);
      expect(metaNativeType(descriptor, typeParams)).toBe(nativeType);
      if (jsonProjection === 'decimal-text') {
        expect(descriptor.projectJson(expression, ref)).toEqual(CastExpr.as(expression, 'text'));
      } else if (jsonProjection === 'base64') {
        expect(descriptor.projectJson(expression, ref)).toEqual(
          FunctionCallExpr.of('encode', [expression, LiteralExpr.of('base64')]),
        );
      } else if (jsonProjection === 'utc-iso') {
        expect(descriptor.projectJson(expression, ref)).toEqual(
          FunctionCallExpr.of('to_char', [
            FunctionCallExpr.of('timezone', [LiteralExpr.of('UTC'), expression]),
            LiteralExpr.of('YYYY-MM-DD"T"HH24:MI:SS.MS"+00:00"'),
          ]),
        );
      } else {
        expect(descriptor.projectJson(expression, ref)).toBe(expression);
      }
    }
  });

  it('builds typed and generic registries over the same ordered descriptors', () => {
    expect(Object.isFrozen(postgresCodecDescriptorRegistry)).toBe(true);
    expect([...postgresCodecDescriptorRegistry.values()]).toEqual(codecDescriptors);

    for (const descriptor of codecDescriptors) {
      expect(postgresCodecDescriptorRegistry.descriptorFor(descriptor.codecId)).toBe(descriptor);
      expect(postgresCodecRegistry.descriptorFor(descriptor.codecId)).toBe(descriptor);
    }
  });

  it('preserves emitted-map order while intentionally omitting text-array', () => {
    const emittedDescriptors = Object.values(codecDescriptorMap);
    const expectedEmittedDescriptors = codecDescriptors.filter(
      (descriptor) => descriptor.codecId !== pgTextArrayDescriptor.codecId,
    );

    expect(emittedDescriptors).toEqual(expectedEmittedDescriptors);
    expect(postgresCodecDescriptorRegistry.descriptorFor(pgDateDescriptor.codecId)).toBe(
      pgDateDescriptor,
    );
    expect(postgresCodecDescriptorRegistry.descriptorFor(pgTextArrayDescriptor.codecId)).toBe(
      pgTextArrayDescriptor,
    );
  });
});
