/**
 * Native Postgres target codecs (TML-2357). Mirrors the SQL base codec form in `packages/2-sql/4-lanes/relational-core/src/ast/sql-codecs.ts`.
 *
 * Each codec ships as three artifacts:
 *
 * 1. A `PgXCodec` class extending {@link CodecImpl} that wraps the module-level encode/decode/encodeJson/decodeJson constants exported from `codec-helpers.ts` (the single source of truth for non-trivial runtime conversions; trivial identity passthroughs are inlined). 2. A `PgXDescriptor` class extending {@link CodecDescriptorImpl} declaring the codec id, traits, target types, params schema, meta, and (where applicable)
 * the emit-path `renderOutputType`. 3. A per-codec column helper (`pgXColumn`) that calls `descriptor.factory(...)` directly and packages the result into a framework `ColumnSpec` via the framework {@link column} packager. The helper is tied to its descriptor with `satisfies ColumnHelperFor` (and `ColumnHelperForStrict` where the resolved codec type is well-defined).
 *
 * After TML-2357 this is the canonical source of Postgres codec metadata and runtime behaviour — the legacy `mkCodec` / `defineCodec` carriers (and the parallel `byScalar`/`codecDescriptorDefinitions`/ `codecDescriptorList` collection exports) retired with the deletion sweep.
 *
 * Audit (parameterized codecs): every parameterized codec in this file is **parameter-stateless** — the params (`length`, `precision`, `precision`+`scale`, `values`) only inform the emit-path `renderOutputType` renderer or stay as JSON metadata. None of the runtime encode/decode/encodeJson/decodeJson conversions thread params into their behavior, so each `factory(_params)` returns a fresh codec constructed solely from
 * `this` (the descriptor).
 */

import type { JsonValue } from '@prisma-next/contract/types';
import {
  type AnyCodecDescriptor,
  type CodecCallContext,
  CodecDescriptorImpl,
  CodecImpl,
  type CodecInstanceContext,
  type CodecMeta,
  type ColumnHelperFor,
  type ColumnHelperForStrict,
  column,
  renderTsLiteral,
  voidParamsSchema,
} from '@prisma-next/framework-components/codec';
import { UNBOUND_NAMESPACE_ID } from '@prisma-next/framework-components/ir';
import {
  SqlCharCodec,
  SqlFloatCodec,
  SqlIntCodec,
  SqlVarcharCodec,
  sqlCharDescriptor,
  sqlFloatDescriptor,
  sqlIntDescriptor,
  sqlTextDescriptor,
  sqlTimestampDescriptor,
  sqlVarcharDescriptor,
} from '@prisma-next/sql-relational-core/ast';
import { blindCast } from '@prisma-next/utils/casts';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { type as arktype } from 'arktype';
import {
  pgByteaDecodeJson,
  pgByteaEncodeJson,
  pgDateDecode,
  pgDateDecodeJson,
  pgDateEncode,
  pgDateEncodeJson,
  pgIntervalDecode,
  pgJsonbDecode,
  pgJsonbEncode,
  pgJsonDecode,
  pgJsonEncode,
  pgNumericDecode,
  pgNumericRenderOutputType,
  pgTimestampDecodeJson,
  pgTimestampEncodeJson,
  pgTimestamptzDecodeJson,
  pgTimestamptzEncodeJson,
  renderLength,
  renderPrecision,
} from './codec-helpers';
import {
  PG_BIT_CODEC_ID,
  PG_BOOL_CODEC_ID,
  PG_BYTEA_CODEC_ID,
  PG_CHAR_CODEC_ID,
  PG_DATE_CODEC_ID,
  PG_ENUM_CODEC_ID,
  PG_FLOAT_CODEC_ID,
  PG_FLOAT4_CODEC_ID,
  PG_FLOAT8_CODEC_ID,
  PG_INET_CODEC_ID,
  PG_INT_CODEC_ID,
  PG_INT2_CODEC_ID,
  PG_INT4_CODEC_ID,
  PG_INT8_CODEC_ID,
  PG_INTERVAL_CODEC_ID,
  PG_JSON_CODEC_ID,
  PG_JSONB_CODEC_ID,
  PG_NUMERIC_CODEC_ID,
  PG_TEXT_ARRAY_CODEC_ID,
  PG_TEXT_CODEC_ID,
  PG_TIME_CODEC_ID,
  PG_TIMESTAMP_CODEC_ID,
  PG_TIMESTAMPTZ_CODEC_ID,
  PG_TIMETZ_CODEC_ID,
  PG_UUID_CODEC_ID,
  PG_VARBIT_CODEC_ID,
  PG_VARCHAR_CODEC_ID,
} from './codec-ids';
import { postgresError } from './errors';
import { DEFAULT_NAMESPACE_ID } from './namespace-ids';
import { PostgresNativeEnum } from './postgres-native-enum';

type LengthParams = { readonly length?: number };
type PrecisionParams = { readonly precision?: number };
type NumericParams = { readonly precision?: number; readonly scale?: number };

const lengthParamsSchema = arktype({
  'length?': 'number.integer > 0',
}) satisfies StandardSchemaV1<LengthParams>;

const numericParamsSchema = arktype({
  'precision?': 'number.integer > 0 & number.integer <= 1000',
  'scale?': 'number.integer >= 0',
}) satisfies StandardSchemaV1<NumericParams>;

const precisionParamsSchema = arktype({
  'precision?': 'number.integer >= 0 & number.integer <= 6',
}) satisfies StandardSchemaV1<PrecisionParams>;

const PG_TEXT_META = { db: { sql: { postgres: { nativeType: 'text' } } } } as const;
const PG_TEXT_ARRAY_META = { db: { sql: { postgres: { nativeType: 'text[]' } } } } as const;
const PG_INT4_META = { db: { sql: { postgres: { nativeType: 'integer' } } } } as const;
const PG_INT2_META = { db: { sql: { postgres: { nativeType: 'smallint' } } } } as const;
const PG_INT8_META = { db: { sql: { postgres: { nativeType: 'bigint' } } } } as const;
const PG_FLOAT4_META = { db: { sql: { postgres: { nativeType: 'real' } } } } as const;
const PG_FLOAT8_META = { db: { sql: { postgres: { nativeType: 'double precision' } } } } as const;
const PG_NUMERIC_META = { db: { sql: { postgres: { nativeType: 'numeric' } } } } as const;
const PG_DATE_META = { db: { sql: { postgres: { nativeType: 'date' } } } } as const;
const PG_TIMESTAMP_META = {
  db: { sql: { postgres: { nativeType: 'timestamp without time zone' } } },
} as const;
const PG_TIMESTAMPTZ_META = {
  db: { sql: { postgres: { nativeType: 'timestamp with time zone' } } },
} as const;
const PG_TIME_META = { db: { sql: { postgres: { nativeType: 'time' } } } } as const;
const PG_TIMETZ_META = { db: { sql: { postgres: { nativeType: 'timetz' } } } } as const;
const PG_BOOL_META = { db: { sql: { postgres: { nativeType: 'boolean' } } } } as const;
const PG_BIT_META = { db: { sql: { postgres: { nativeType: 'bit' } } } } as const;
const PG_VARBIT_META = { db: { sql: { postgres: { nativeType: 'bit varying' } } } } as const;
const PG_BYTEA_META = { db: { sql: { postgres: { nativeType: 'bytea' } } } } as const;
const PG_INTERVAL_META = { db: { sql: { postgres: { nativeType: 'interval' } } } } as const;
const PG_JSON_META = { db: { sql: { postgres: { nativeType: 'json' } } } } as const;
const PG_JSONB_META = { db: { sql: { postgres: { nativeType: 'jsonb' } } } } as const;

export class PgTextCodec extends CodecImpl<
  typeof PG_TEXT_CODEC_ID,
  readonly ['equality', 'order', 'textual'],
  string,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  encodeJson(value: string): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): string {
    return json as string;
  }
}

export class PgTextDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_TEXT_CODEC_ID;
  override readonly traits = ['equality', 'order', 'textual'] as const;
  override readonly targetTypes = ['text'] as const;
  override readonly meta = PG_TEXT_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => PgTextCodec {
    return () => new PgTextCodec(this);
  }
}

export const pgTextDescriptor = new PgTextDescriptor();

export const pgTextColumn = () =>
  column(pgTextDescriptor.factory(), pgTextDescriptor.codecId, undefined, 'text');

pgTextColumn satisfies ColumnHelperFor<PgTextDescriptor>;
pgTextColumn satisfies ColumnHelperForStrict<PgTextDescriptor>;

/**
 * Codec for a `pg.enum(Ref)` column bound to a native Postgres enum type.
 * Text passthrough, identical to `pg/text@1` — encode/decode do not carry the
 * enum's member values; membership is enforced by the native type itself, not
 * by this codec. `renderValueLiteral` renders a member value as its TS
 * literal, which is what drives the column's typed value-union (via
 * `renderValueSetType` reading the column's `valueSet` ref) — the codec
 * itself carries no params of its own; typing comes entirely from the
 * column's value-set, not from `pg/enum@1`.
 *
 * A distinct codec id (rather than reusing `pg/text@1` on a plain text
 * column) keeps native-enum columns independently identifiable — from a
 * column's `codecId` alone, without also inspecting `nativeType` — which
 * the managed (DDL) phase needs to target `CREATE TYPE`/`ALTER TYPE`
 * operations at exactly the columns that use one.
 */
export class PgEnumCodec extends CodecImpl<
  typeof PG_ENUM_CODEC_ID,
  readonly ['equality', 'order', 'textual'],
  string,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  encodeJson(value: string): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): string {
    return blindCast<
      string,
      'text codec: a native-enum member value is stored as its wire string form'
    >(json);
  }
}

export type PgEnumParams = { readonly typeName: string };

/**
 * Narrows codec `typeParams` to {@link PgEnumParams} — the shape that binds a
 * column to a named database type (a native enum's `CREATE TYPE` name).
 */
export function isPgEnumParams(value: unknown): value is PgEnumParams {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'typeName' in value &&
    typeof value.typeName === 'string'
  );
}

const pgEnumParamsSchema = arktype({
  typeName: 'string',
}) satisfies StandardSchemaV1<PgEnumParams>;

export class PgEnumDescriptor extends CodecDescriptorImpl<PgEnumParams> {
  override readonly codecId = PG_ENUM_CODEC_ID;
  override readonly traits = ['equality', 'order', 'textual'] as const;
  override readonly targetTypes = ['text'] as const;
  override readonly meta = PG_TEXT_META;
  override readonly paramsSchema = pgEnumParamsSchema satisfies StandardSchemaV1<PgEnumParams>;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override metaFor(typeParams: JsonValue | undefined): CodecMeta | undefined {
    return isPgEnumParams(typeParams)
      ? { db: { sql: { postgres: { nativeType: typeParams.typeName } } } }
      : this.meta;
  }
  override factory(_params: PgEnumParams): (ctx: CodecInstanceContext) => PgEnumCodec {
    return () => new PgEnumCodec(this);
  }

  /**
   * Authoring-time hook a `pg.enum(<ref>)` type constructor calls once it has
   * resolved its ref argument to the referenced `native_enum` entity:
   * produces this codec's per-column `typeParams` and native type from the
   * entity's bare type name. Schema-qualification (`auth.aal_level` for a
   * named non-default schema) is not this hook's concern — the field's
   * namespace isn't known at this call site for every authoring path (the TS
   * builder resolves a column before it knows its model's namespace), so it is
   * applied later, at contract construction, by {@link qualifyNativeType} via
   * the target's `authoring.qualifyColumnType` hook. `nativeType` mirrors
   * `typeParams.typeName` — the same value {@link metaFor} derives at render
   * time — so the column's declared native type and the render-time cast
   * agree. Returns `undefined` if `entity` is not a `PostgresNativeEnum` (a
   * contributor bug, not a user-schema error — the caller decides how to
   * report it).
   */
  columnFromEntity(
    entity: object,
  ): { readonly typeParams: PgEnumParams; readonly nativeType: string } | undefined {
    if (!PostgresNativeEnum.is(entity)) return undefined;
    return { typeParams: { typeName: entity.typeName }, nativeType: entity.typeName };
  }

  /**
   * Schema-qualifies this native enum type's name for the namespace the
   * consuming column lives in: `${namespaceId}.${typeName}` for a named
   * non-default schema, bare for the target's default schema (`public`) or
   * the late-bound unbound sentinel (whose schema `search_path` resolves at
   * runtime). Postgres's `format_type()` reports the bare name for a
   * public-schema type, so a public column's declared native type must stay
   * bare to match. Owned here because the codec owns its native type.
   */
  qualifyNativeType(typeName: string, namespaceId: string): string {
    return namespaceId === DEFAULT_NAMESPACE_ID || namespaceId === UNBOUND_NAMESPACE_ID
      ? typeName
      : `${namespaceId}.${typeName}`;
  }
}

export const pgEnumDescriptor = new PgEnumDescriptor();

/**
 * Contract-construction-time column-type qualifier the Postgres target
 * contributes through `authoring.qualifyColumnType`.
 * `buildSqlContractFromDefinition` calls this for every column as it is
 * constructed, passing the column's bare type info and its owning
 * `namespaceId`; a native-enum column (`pg/enum@1`) gets its type name
 * schema-qualified for that namespace (via
 * {@link PgEnumDescriptor.qualifyNativeType}), keeping `nativeType` and
 * `typeParams.typeName` in sync. Every other codec passes through unchanged.
 * Both the PSL `pg.enum(Ref)` path and the TS `pg.enum(handle)` path route
 * through here — the dispatch keys off the codec id, not authoring surface.
 */
export function postgresQualifyColumnType(
  input: {
    readonly codecId: string;
    readonly nativeType: string;
    readonly typeParams?: Record<string, unknown>;
  },
  namespaceId: string,
): { readonly nativeType: string; readonly typeParams?: Record<string, unknown> } {
  if (input.codecId !== PG_ENUM_CODEC_ID) return input;
  const bareTypeName = input.typeParams?.['typeName'];
  if (typeof bareTypeName !== 'string') return input;
  const qualified = pgEnumDescriptor.qualifyNativeType(bareTypeName, namespaceId);
  return { nativeType: qualified, typeParams: { ...input.typeParams, typeName: qualified } };
}

/**
 * Postgres `text[]` codec. Encode is an identity pass-through: the pg wire
 * driver serialises a JS `string[]` to a Postgres array literal under the
 * `$N::text[]` cast the renderer emits from this codec's `text[]` native type,
 * and decode reads it back as a JS array. Used by the control plane to write
 * the marker's `invariants` column. Not a user-facing scalar — it is not part
 * of the authorable `CodecTypes` surface, only the runtime codec registry.
 */
export class PgTextArrayCodec extends CodecImpl<
  typeof PG_TEXT_ARRAY_CODEC_ID,
  readonly ['equality'],
  readonly string[],
  readonly string[]
> {
  async encode(value: readonly string[], _ctx: CodecCallContext): Promise<readonly string[]> {
    return value;
  }
  async decode(wire: readonly string[], _ctx: CodecCallContext): Promise<readonly string[]> {
    return wire;
  }
  encodeJson(value: readonly string[]): JsonValue {
    return [...value];
  }
  decodeJson(json: JsonValue): readonly string[] {
    return Array.isArray(json) ? json.map((entry) => String(entry)) : [];
  }
}

export class PgTextArrayDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_TEXT_ARRAY_CODEC_ID;
  override readonly traits = ['equality'] as const;
  override readonly targetTypes = ['text[]'] as const;
  override readonly meta = PG_TEXT_ARRAY_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => PgTextArrayCodec {
    return () => new PgTextArrayCodec(this);
  }
}

export const pgTextArrayDescriptor = new PgTextArrayDescriptor();

export class PgInt4Codec extends CodecImpl<
  typeof PG_INT4_CODEC_ID,
  readonly ['equality', 'order', 'numeric'],
  number,
  number
> {
  async encode(value: number, _ctx: CodecCallContext): Promise<number> {
    return value;
  }
  async decode(wire: number, _ctx: CodecCallContext): Promise<number> {
    return wire;
  }
  encodeJson(value: number): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): number {
    return json as number;
  }
}

export class PgInt4Descriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_INT4_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly targetTypes = ['int4'] as const;
  override readonly meta = PG_INT4_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => PgInt4Codec {
    return () => new PgInt4Codec(this);
  }
}

export const pgInt4Descriptor = new PgInt4Descriptor();

export const pgInt4Column = () =>
  column(pgInt4Descriptor.factory(), pgInt4Descriptor.codecId, undefined, 'int4');

pgInt4Column satisfies ColumnHelperFor<PgInt4Descriptor>;
pgInt4Column satisfies ColumnHelperForStrict<PgInt4Descriptor>;

export class PgInt2Codec extends CodecImpl<
  typeof PG_INT2_CODEC_ID,
  readonly ['equality', 'order', 'numeric'],
  number,
  number
> {
  async encode(value: number, _ctx: CodecCallContext): Promise<number> {
    return value;
  }
  async decode(wire: number, _ctx: CodecCallContext): Promise<number> {
    return wire;
  }
  encodeJson(value: number): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): number {
    return json as number;
  }
}

export class PgInt2Descriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_INT2_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly targetTypes = ['int2'] as const;
  override readonly meta = PG_INT2_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => PgInt2Codec {
    return () => new PgInt2Codec(this);
  }
}

export const pgInt2Descriptor = new PgInt2Descriptor();

export const pgInt2Column = () =>
  column(pgInt2Descriptor.factory(), pgInt2Descriptor.codecId, undefined, 'int2');

pgInt2Column satisfies ColumnHelperFor<PgInt2Descriptor>;
pgInt2Column satisfies ColumnHelperForStrict<PgInt2Descriptor>;

export class PgInt8Codec extends CodecImpl<
  typeof PG_INT8_CODEC_ID,
  readonly ['equality', 'order', 'numeric'],
  number,
  number
> {
  async encode(value: number, _ctx: CodecCallContext): Promise<number> {
    return value;
  }
  async decode(wire: number, _ctx: CodecCallContext): Promise<number> {
    return wire;
  }
  encodeJson(value: number): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): number {
    return json as number;
  }
}

export class PgInt8Descriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_INT8_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly targetTypes = ['int8'] as const;
  override readonly meta = PG_INT8_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => PgInt8Codec {
    return () => new PgInt8Codec(this);
  }
}

export const pgInt8Descriptor = new PgInt8Descriptor();

export const pgInt8Column = () =>
  column(pgInt8Descriptor.factory(), pgInt8Descriptor.codecId, undefined, 'int8');

pgInt8Column satisfies ColumnHelperFor<PgInt8Descriptor>;
pgInt8Column satisfies ColumnHelperForStrict<PgInt8Descriptor>;

export class PgFloat4Codec extends CodecImpl<
  typeof PG_FLOAT4_CODEC_ID,
  readonly ['equality', 'order', 'numeric'],
  number,
  number
> {
  async encode(value: number, _ctx: CodecCallContext): Promise<number> {
    return value;
  }
  async decode(wire: number, _ctx: CodecCallContext): Promise<number> {
    return wire;
  }
  encodeJson(value: number): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): number {
    return json as number;
  }
}

export class PgFloat4Descriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_FLOAT4_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly targetTypes = ['float4'] as const;
  override readonly meta = PG_FLOAT4_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => PgFloat4Codec {
    return () => new PgFloat4Codec(this);
  }
}

export const pgFloat4Descriptor = new PgFloat4Descriptor();

export const pgFloat4Column = () =>
  column(pgFloat4Descriptor.factory(), pgFloat4Descriptor.codecId, undefined, 'float4');

pgFloat4Column satisfies ColumnHelperFor<PgFloat4Descriptor>;
pgFloat4Column satisfies ColumnHelperForStrict<PgFloat4Descriptor>;

export class PgFloat8Codec extends CodecImpl<
  typeof PG_FLOAT8_CODEC_ID,
  readonly ['equality', 'order', 'numeric'],
  number,
  number
> {
  async encode(value: number, _ctx: CodecCallContext): Promise<number> {
    return value;
  }
  async decode(wire: number, _ctx: CodecCallContext): Promise<number> {
    return wire;
  }
  encodeJson(value: number): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): number {
    return json as number;
  }
}

export class PgFloat8Descriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_FLOAT8_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly targetTypes = ['float8'] as const;
  override readonly meta = PG_FLOAT8_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => PgFloat8Codec {
    return () => new PgFloat8Codec(this);
  }
}

export const pgFloat8Descriptor = new PgFloat8Descriptor();

export const pgFloat8Column = () =>
  column(pgFloat8Descriptor.factory(), pgFloat8Descriptor.codecId, undefined, 'float8');

pgFloat8Column satisfies ColumnHelperFor<PgFloat8Descriptor>;
pgFloat8Column satisfies ColumnHelperForStrict<PgFloat8Descriptor>;

export class PgBoolCodec extends CodecImpl<
  typeof PG_BOOL_CODEC_ID,
  readonly ['equality', 'boolean'],
  boolean,
  boolean
> {
  async encode(value: boolean, _ctx: CodecCallContext): Promise<boolean> {
    return value;
  }
  async decode(wire: boolean, _ctx: CodecCallContext): Promise<boolean> {
    return wire;
  }
  encodeJson(value: boolean): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): boolean {
    return json as boolean;
  }
}

export class PgBoolDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_BOOL_CODEC_ID;
  override readonly traits = ['equality', 'boolean'] as const;
  override readonly targetTypes = ['bool'] as const;
  override readonly meta = PG_BOOL_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => PgBoolCodec {
    return () => new PgBoolCodec(this);
  }
}

export const pgBoolDescriptor = new PgBoolDescriptor();

export const pgBoolColumn = () =>
  column(pgBoolDescriptor.factory(), pgBoolDescriptor.codecId, undefined, 'bool');

pgBoolColumn satisfies ColumnHelperFor<PgBoolDescriptor>;
pgBoolColumn satisfies ColumnHelperForStrict<PgBoolDescriptor>;

export class PgNumericCodec extends CodecImpl<
  typeof PG_NUMERIC_CODEC_ID,
  readonly ['equality', 'order', 'numeric'],
  string | number,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string | number, _ctx: CodecCallContext): Promise<string> {
    return pgNumericDecode(wire);
  }
  encodeJson(value: string): JsonValue {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw postgresError(
        'RUNTIME.ENCODE_FAILED',
        'pg/numeric@1 database JSON value must be a finite number',
        { meta: { codecId: 'pg/numeric@1', received: value } },
      );
    }
    return number;
  }
  decodeJson(json: JsonValue): string {
    if (typeof json !== 'number') {
      throw postgresError(
        'RUNTIME.DECODE_FAILED',
        'pg/numeric@1 database JSON value must be a number',
        { meta: { codecId: 'pg/numeric@1', received: typeof json } },
      );
    }
    return pgNumericDecode(json);
  }
}

export class PgNumericDescriptor extends CodecDescriptorImpl<NumericParams> {
  override readonly codecId = PG_NUMERIC_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly targetTypes = ['numeric', 'decimal'] as const;
  override readonly meta = PG_NUMERIC_META;
  override readonly paramsSchema = numericParamsSchema satisfies StandardSchemaV1<NumericParams>;
  override renderOutputType(params: NumericParams): string | undefined {
    return pgNumericRenderOutputType(params);
  }
  override factory(_params: NumericParams): (ctx: CodecInstanceContext) => PgNumericCodec {
    return () => new PgNumericCodec(this);
  }
}

export const pgNumericDescriptor = new PgNumericDescriptor();

export const pgNumericColumn = (params: NumericParams = {}) =>
  column(pgNumericDescriptor.factory(params), pgNumericDescriptor.codecId, params, 'numeric');

pgNumericColumn satisfies ColumnHelperFor<PgNumericDescriptor>;
pgNumericColumn satisfies ColumnHelperForStrict<PgNumericDescriptor>;

/**
 * A Postgres `date` has no time-of-day or timezone component. This codec
 * canonicalizes its JS-level value as a `Date` at UTC midnight, so its
 * round-trip is independent of the process's local timezone — see
 * `pgDateEncode`/`pgDateDecode` in `codec-helpers.ts`.
 */
export class PgDateCodec extends CodecImpl<
  typeof PG_DATE_CODEC_ID,
  readonly ['equality', 'order'],
  Date | string,
  Date
> {
  async encode(value: Date, _ctx: CodecCallContext): Promise<string> {
    return pgDateEncode(value);
  }
  async decode(wire: Date, _ctx: CodecCallContext): Promise<Date> {
    return pgDateDecode(wire);
  }
  encodeJson(value: Date): JsonValue {
    return pgDateEncodeJson(value);
  }
  decodeJson(json: JsonValue): Date {
    return pgDateDecodeJson(json);
  }
}

export class PgDateDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_DATE_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['date'] as const;
  override readonly meta = PG_DATE_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => PgDateCodec {
    return () => new PgDateCodec(this);
  }
}

export const pgDateDescriptor = new PgDateDescriptor();

export const pgDateColumn = () =>
  column(pgDateDescriptor.factory(), pgDateDescriptor.codecId, undefined, 'date');

pgDateColumn satisfies ColumnHelperFor<PgDateDescriptor>;
pgDateColumn satisfies ColumnHelperForStrict<PgDateDescriptor>;

export class PgTimestampCodec extends CodecImpl<
  typeof PG_TIMESTAMP_CODEC_ID,
  readonly ['equality', 'order'],
  Date,
  Date
> {
  async encode(value: Date, _ctx: CodecCallContext): Promise<Date> {
    return value;
  }
  async decode(wire: Date, _ctx: CodecCallContext): Promise<Date> {
    return wire;
  }
  encodeJson(value: Date): JsonValue {
    return pgTimestampEncodeJson(value);
  }
  decodeJson(json: JsonValue): Date {
    return pgTimestampDecodeJson(json);
  }
}

export class PgTimestampDescriptor extends CodecDescriptorImpl<PrecisionParams> {
  override readonly codecId = PG_TIMESTAMP_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['timestamp'] as const;
  override readonly meta = PG_TIMESTAMP_META;
  override readonly paramsSchema =
    precisionParamsSchema satisfies StandardSchemaV1<PrecisionParams>;
  override renderOutputType(params: PrecisionParams): string | undefined {
    return renderPrecision('Timestamp', params as Record<string, unknown>);
  }
  override factory(_params: PrecisionParams): (ctx: CodecInstanceContext) => PgTimestampCodec {
    return () => new PgTimestampCodec(this);
  }
}

export const pgTimestampDescriptor = new PgTimestampDescriptor();

export const pgTimestampColumn = (params: PrecisionParams = {}) =>
  column(pgTimestampDescriptor.factory(params), pgTimestampDescriptor.codecId, params, 'timestamp');

pgTimestampColumn satisfies ColumnHelperFor<PgTimestampDescriptor>;
pgTimestampColumn satisfies ColumnHelperForStrict<PgTimestampDescriptor>;

export class PgTimestamptzCodec extends CodecImpl<
  typeof PG_TIMESTAMPTZ_CODEC_ID,
  readonly ['equality', 'order'],
  Date,
  Date
> {
  async encode(value: Date, _ctx: CodecCallContext): Promise<Date> {
    return value;
  }
  async decode(wire: Date, _ctx: CodecCallContext): Promise<Date> {
    return wire;
  }
  encodeJson(value: Date): JsonValue {
    return pgTimestamptzEncodeJson(value);
  }
  decodeJson(json: JsonValue): Date {
    return pgTimestamptzDecodeJson(json);
  }
}

export class PgTimestamptzDescriptor extends CodecDescriptorImpl<PrecisionParams> {
  override readonly codecId = PG_TIMESTAMPTZ_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['timestamptz'] as const;
  override readonly meta = PG_TIMESTAMPTZ_META;
  override readonly paramsSchema =
    precisionParamsSchema satisfies StandardSchemaV1<PrecisionParams>;
  override renderOutputType(params: PrecisionParams): string | undefined {
    return renderPrecision('Timestamptz', params as Record<string, unknown>);
  }
  override factory(_params: PrecisionParams): (ctx: CodecInstanceContext) => PgTimestamptzCodec {
    return () => new PgTimestamptzCodec(this);
  }
}

export const pgTimestamptzDescriptor = new PgTimestamptzDescriptor();

export const pgTimestamptzColumn = (params: PrecisionParams = {}) =>
  column(
    pgTimestamptzDescriptor.factory(params),
    pgTimestamptzDescriptor.codecId,
    params,
    'timestamptz',
  );

pgTimestamptzColumn satisfies ColumnHelperFor<PgTimestamptzDescriptor>;
pgTimestamptzColumn satisfies ColumnHelperForStrict<PgTimestamptzDescriptor>;

export class PgTimeCodec extends CodecImpl<
  typeof PG_TIME_CODEC_ID,
  readonly ['equality', 'order'],
  string,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  encodeJson(value: string): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): string {
    return json as string;
  }
}

export class PgTimeDescriptor extends CodecDescriptorImpl<PrecisionParams> {
  override readonly codecId = PG_TIME_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['time'] as const;
  override readonly meta = PG_TIME_META;
  override readonly paramsSchema =
    precisionParamsSchema satisfies StandardSchemaV1<PrecisionParams>;
  override renderOutputType(params: PrecisionParams): string | undefined {
    return renderPrecision('Time', params as Record<string, unknown>);
  }
  override factory(_params: PrecisionParams): (ctx: CodecInstanceContext) => PgTimeCodec {
    return () => new PgTimeCodec(this);
  }
}

export const pgTimeDescriptor = new PgTimeDescriptor();

export const pgTimeColumn = (params: PrecisionParams = {}) =>
  column(pgTimeDescriptor.factory(params), pgTimeDescriptor.codecId, params, 'time');

pgTimeColumn satisfies ColumnHelperFor<PgTimeDescriptor>;
pgTimeColumn satisfies ColumnHelperForStrict<PgTimeDescriptor>;

export class PgTimetzCodec extends CodecImpl<
  typeof PG_TIMETZ_CODEC_ID,
  readonly ['equality', 'order'],
  string,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  encodeJson(value: string): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): string {
    return json as string;
  }
}

export class PgTimetzDescriptor extends CodecDescriptorImpl<PrecisionParams> {
  override readonly codecId = PG_TIMETZ_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['timetz'] as const;
  override readonly meta = PG_TIMETZ_META;
  override readonly paramsSchema =
    precisionParamsSchema satisfies StandardSchemaV1<PrecisionParams>;
  override renderOutputType(params: PrecisionParams): string | undefined {
    return renderPrecision('Timetz', params as Record<string, unknown>);
  }
  override factory(_params: PrecisionParams): (ctx: CodecInstanceContext) => PgTimetzCodec {
    return () => new PgTimetzCodec(this);
  }
}

export const pgTimetzDescriptor = new PgTimetzDescriptor();

export const pgTimetzColumn = (params: PrecisionParams = {}) =>
  column(pgTimetzDescriptor.factory(params), pgTimetzDescriptor.codecId, params, 'timetz');

pgTimetzColumn satisfies ColumnHelperFor<PgTimetzDescriptor>;
pgTimetzColumn satisfies ColumnHelperForStrict<PgTimetzDescriptor>;

export class PgBitCodec extends CodecImpl<
  typeof PG_BIT_CODEC_ID,
  readonly ['equality', 'order'],
  string,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  encodeJson(value: string): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): string {
    return json as string;
  }
}

export class PgBitDescriptor extends CodecDescriptorImpl<LengthParams> {
  override readonly codecId = PG_BIT_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['bit'] as const;
  override readonly meta = PG_BIT_META;
  override readonly paramsSchema = lengthParamsSchema satisfies StandardSchemaV1<LengthParams>;
  override renderOutputType(params: LengthParams): string | undefined {
    return renderLength('Bit', params as Record<string, unknown>);
  }
  override factory(_params: LengthParams): (ctx: CodecInstanceContext) => PgBitCodec {
    return () => new PgBitCodec(this);
  }
}

export const pgBitDescriptor = new PgBitDescriptor();

export const pgBitColumn = (params: LengthParams = {}) =>
  column(pgBitDescriptor.factory(params), pgBitDescriptor.codecId, params, 'bit');

pgBitColumn satisfies ColumnHelperFor<PgBitDescriptor>;
pgBitColumn satisfies ColumnHelperForStrict<PgBitDescriptor>;

export class PgVarbitCodec extends CodecImpl<
  typeof PG_VARBIT_CODEC_ID,
  readonly ['equality', 'order'],
  string,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  encodeJson(value: string): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): string {
    return json as string;
  }
}

export class PgVarbitDescriptor extends CodecDescriptorImpl<LengthParams> {
  override readonly codecId = PG_VARBIT_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['bit varying'] as const;
  override readonly meta = PG_VARBIT_META;
  override readonly paramsSchema = lengthParamsSchema satisfies StandardSchemaV1<LengthParams>;
  override renderOutputType(params: LengthParams): string | undefined {
    return renderLength('VarBit', params as Record<string, unknown>);
  }
  override factory(_params: LengthParams): (ctx: CodecInstanceContext) => PgVarbitCodec {
    return () => new PgVarbitCodec(this);
  }
}

export const pgVarbitDescriptor = new PgVarbitDescriptor();

export const pgVarbitColumn = (params: LengthParams = {}) =>
  column(pgVarbitDescriptor.factory(params), pgVarbitDescriptor.codecId, params, 'bit varying');

pgVarbitColumn satisfies ColumnHelperFor<PgVarbitDescriptor>;
pgVarbitColumn satisfies ColumnHelperForStrict<PgVarbitDescriptor>;

export class PgByteaCodec extends CodecImpl<
  typeof PG_BYTEA_CODEC_ID,
  readonly ['equality'],
  Uint8Array,
  Uint8Array
> {
  async encode(value: Uint8Array, _ctx: CodecCallContext): Promise<Uint8Array> {
    return value;
  }
  async decode(wire: Uint8Array, _ctx: CodecCallContext): Promise<Uint8Array> {
    // Postgres node drivers commonly return Buffer instances (which extend Uint8Array) — normalize to a plain Uint8Array view so engine-agnostic consumers don't accidentally observe Buffer-specific APIs.
    return wire instanceof Uint8Array && wire.constructor === Uint8Array
      ? wire
      : new Uint8Array(wire.buffer, wire.byteOffset, wire.byteLength);
  }
  encodeJson(value: Uint8Array): JsonValue {
    return pgByteaEncodeJson(value);
  }
  decodeJson(json: JsonValue): Uint8Array {
    return pgByteaDecodeJson(json);
  }
}

export class PgByteaDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_BYTEA_CODEC_ID;
  override readonly traits = ['equality'] as const;
  override readonly targetTypes = ['bytea'] as const;
  override readonly meta = PG_BYTEA_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => PgByteaCodec {
    return () => new PgByteaCodec(this);
  }
}

export const pgByteaDescriptor = new PgByteaDescriptor();

export const pgByteaColumn = () =>
  column(pgByteaDescriptor.factory(), pgByteaDescriptor.codecId, undefined, 'bytea');

pgByteaColumn satisfies ColumnHelperFor<PgByteaDescriptor>;
pgByteaColumn satisfies ColumnHelperForStrict<PgByteaDescriptor>;

const PG_UUID_META = { db: { sql: { postgres: { nativeType: 'uuid' } } } } as const;

export class PgUuidCodec extends CodecImpl<
  typeof PG_UUID_CODEC_ID,
  readonly ['equality', 'order'],
  string,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  encodeJson(value: string): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): string {
    return blindCast<string, 'uuid columns serialize to JSON as their wire string form'>(json);
  }
}

export class PgUuidDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_UUID_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['uuid'] as const;
  override readonly meta = PG_UUID_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => PgUuidCodec {
    return () => new PgUuidCodec(this);
  }
}

export const pgUuidDescriptor = new PgUuidDescriptor();

export const pgUuidColumn = () =>
  column(pgUuidDescriptor.factory(), pgUuidDescriptor.codecId, undefined, 'uuid');

pgUuidColumn satisfies ColumnHelperFor<PgUuidDescriptor>;
pgUuidColumn satisfies ColumnHelperForStrict<PgUuidDescriptor>;

const PG_INET_META = { db: { sql: { postgres: { nativeType: 'inet' } } } } as const;

export class PgInetCodec extends CodecImpl<
  typeof PG_INET_CODEC_ID,
  readonly ['equality', 'order'],
  string,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string, _ctx: CodecCallContext): Promise<string> {
    return wire;
  }
  encodeJson(value: string): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): string {
    return blindCast<string, 'inet columns serialize to JSON as their wire string form'>(json);
  }
}

export class PgInetDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_INET_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['inet'] as const;
  override readonly meta = PG_INET_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => PgInetCodec {
    return () => new PgInetCodec(this);
  }
}

export const pgInetDescriptor = new PgInetDescriptor();

export const pgInetColumn = () =>
  column(pgInetDescriptor.factory(), pgInetDescriptor.codecId, undefined, 'inet');

pgInetColumn satisfies ColumnHelperFor<PgInetDescriptor>;
pgInetColumn satisfies ColumnHelperForStrict<PgInetDescriptor>;

export class PgIntervalCodec extends CodecImpl<
  typeof PG_INTERVAL_CODEC_ID,
  readonly ['equality', 'order'],
  string | Record<string, unknown>,
  string
> {
  async encode(value: string, _ctx: CodecCallContext): Promise<string> {
    return value;
  }
  async decode(wire: string | Record<string, unknown>, _ctx: CodecCallContext): Promise<string> {
    return pgIntervalDecode(wire);
  }
  encodeJson(value: string): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): string {
    return json as string;
  }
}

export class PgIntervalDescriptor extends CodecDescriptorImpl<PrecisionParams> {
  override readonly codecId = PG_INTERVAL_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['interval'] as const;
  override readonly meta = PG_INTERVAL_META;
  override readonly paramsSchema =
    precisionParamsSchema satisfies StandardSchemaV1<PrecisionParams>;
  override renderOutputType(params: PrecisionParams): string | undefined {
    return renderPrecision('Interval', params as Record<string, unknown>);
  }
  override factory(_params: PrecisionParams): (ctx: CodecInstanceContext) => PgIntervalCodec {
    return () => new PgIntervalCodec(this);
  }
}

export const pgIntervalDescriptor = new PgIntervalDescriptor();

export const pgIntervalColumn = (params: PrecisionParams = {}) =>
  column(pgIntervalDescriptor.factory(params), pgIntervalDescriptor.codecId, params, 'interval');

pgIntervalColumn satisfies ColumnHelperFor<PgIntervalDescriptor>;
pgIntervalColumn satisfies ColumnHelperForStrict<PgIntervalDescriptor>;

export class PgJsonCodec extends CodecImpl<
  typeof PG_JSON_CODEC_ID,
  readonly [],
  string | JsonValue,
  JsonValue
> {
  async encode(value: JsonValue, _ctx: CodecCallContext): Promise<string> {
    return pgJsonEncode(value);
  }
  async decode(wire: string | JsonValue, _ctx: CodecCallContext): Promise<JsonValue> {
    return pgJsonDecode(wire);
  }
  encodeJson(value: JsonValue): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): JsonValue {
    return json;
  }
}

export class PgJsonDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_JSON_CODEC_ID;
  override readonly traits = [] as const;
  override readonly targetTypes = ['json'] as const;
  override readonly meta = PG_JSON_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => PgJsonCodec {
    return () => new PgJsonCodec(this);
  }
}

export const pgJsonDescriptor = new PgJsonDescriptor();

export const pgJsonColumn = () =>
  column(pgJsonDescriptor.factory(), pgJsonDescriptor.codecId, undefined, 'json');

pgJsonColumn satisfies ColumnHelperFor<PgJsonDescriptor>;
pgJsonColumn satisfies ColumnHelperForStrict<PgJsonDescriptor>;

export class PgJsonbCodec extends CodecImpl<
  typeof PG_JSONB_CODEC_ID,
  readonly ['equality'],
  string | JsonValue,
  JsonValue
> {
  async encode(value: JsonValue, _ctx: CodecCallContext): Promise<string> {
    return pgJsonbEncode(value);
  }
  async decode(wire: string | JsonValue, _ctx: CodecCallContext): Promise<JsonValue> {
    return pgJsonbDecode(wire);
  }
  encodeJson(value: JsonValue): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): JsonValue {
    return json;
  }
}

export class PgJsonbDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_JSONB_CODEC_ID;
  override readonly traits = ['equality'] as const;
  override readonly targetTypes = ['jsonb'] as const;
  override readonly meta = PG_JSONB_META;
  override readonly paramsSchema: StandardSchemaV1<void> = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => PgJsonbCodec {
    return () => new PgJsonbCodec(this);
  }
}

export const pgJsonbDescriptor = new PgJsonbDescriptor();

export const pgJsonbColumn = () =>
  column(pgJsonbDescriptor.factory(), pgJsonbDescriptor.codecId, undefined, 'jsonb');

pgJsonbColumn satisfies ColumnHelperFor<PgJsonbDescriptor>;
pgJsonbColumn satisfies ColumnHelperForStrict<PgJsonbDescriptor>;

// `meta`. The factories instantiate the SQL-base codec class (`SqlCharCodec` etc.) passing `this` (the pg-alias descriptor) so `codec.id` resolves to the pg-alias codec id via `CodecImpl`'s `descriptor.codecId` proxy. ---------------------------------------------------------------------------

const PG_CHAR_META = { db: { sql: { postgres: { nativeType: 'character' } } } } as const;
const PG_VARCHAR_META = {
  db: { sql: { postgres: { nativeType: 'character varying' } } },
} as const;
const PG_INT_META = { db: { sql: { postgres: { nativeType: 'integer' } } } } as const;
const PG_FLOAT_META = { db: { sql: { postgres: { nativeType: 'double precision' } } } } as const;

export class PgCharDescriptor extends CodecDescriptorImpl<LengthParams> {
  override readonly codecId = PG_CHAR_CODEC_ID;
  override readonly targetTypes = ['character'] as const;
  override readonly meta = PG_CHAR_META;
  override readonly traits = sqlCharDescriptor.traits;
  override readonly paramsSchema = sqlCharDescriptor.paramsSchema;
  override renderOutputType(params: LengthParams): string | undefined {
    return sqlCharDescriptor.renderOutputType(params);
  }
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(_params: LengthParams): (ctx: CodecInstanceContext) => SqlCharCodec {
    return () => new SqlCharCodec(this);
  }
}

export const pgCharDescriptor = new PgCharDescriptor();

export const pgCharColumn = (params: LengthParams = {}) =>
  column(pgCharDescriptor.factory(params), pgCharDescriptor.codecId, params, 'character');

pgCharColumn satisfies ColumnHelperFor<PgCharDescriptor>;

export class PgVarcharDescriptor extends CodecDescriptorImpl<LengthParams> {
  override readonly codecId = PG_VARCHAR_CODEC_ID;
  override readonly targetTypes = ['character varying'] as const;
  override readonly meta = PG_VARCHAR_META;
  override readonly traits = sqlVarcharDescriptor.traits;
  override readonly paramsSchema = sqlVarcharDescriptor.paramsSchema;
  override renderOutputType(params: LengthParams): string | undefined {
    return sqlVarcharDescriptor.renderOutputType(params);
  }
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(_params: LengthParams): (ctx: CodecInstanceContext) => SqlVarcharCodec {
    return () => new SqlVarcharCodec(this);
  }
}

export const pgVarcharDescriptor = new PgVarcharDescriptor();

export const pgVarcharColumn = (params: LengthParams = {}) =>
  column(
    pgVarcharDescriptor.factory(params),
    pgVarcharDescriptor.codecId,
    params,
    'character varying',
  );

pgVarcharColumn satisfies ColumnHelperFor<PgVarcharDescriptor>;

export class PgIntDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_INT_CODEC_ID;
  override readonly targetTypes = ['int4'] as const;
  override readonly meta = PG_INT_META;
  override readonly traits = sqlIntDescriptor.traits;
  override readonly paramsSchema = sqlIntDescriptor.paramsSchema;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => SqlIntCodec {
    return () => new SqlIntCodec(this);
  }
}

export const pgIntDescriptor = new PgIntDescriptor();

export const pgIntColumn = () =>
  column(pgIntDescriptor.factory(), pgIntDescriptor.codecId, undefined, 'int4');

pgIntColumn satisfies ColumnHelperFor<PgIntDescriptor>;

export class PgFloatDescriptor extends CodecDescriptorImpl<void> {
  override readonly codecId = PG_FLOAT_CODEC_ID;
  override readonly targetTypes = ['float8'] as const;
  override readonly meta = PG_FLOAT_META;
  override readonly traits = sqlFloatDescriptor.traits;
  override readonly paramsSchema = sqlFloatDescriptor.paramsSchema;
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  override factory(): (ctx: CodecInstanceContext) => SqlFloatCodec {
    return () => new SqlFloatCodec(this);
  }
}

export const pgFloatDescriptor = new PgFloatDescriptor();

export const pgFloatColumn = () =>
  column(pgFloatDescriptor.factory(), pgFloatDescriptor.codecId, undefined, 'float8');

pgFloatColumn satisfies ColumnHelperFor<PgFloatDescriptor>;

// `ExtractCodecTypes` to derive `CodecTypes`. ---------------------------------------------------------------------------

export const codecDescriptors: readonly AnyCodecDescriptor[] = [
  sqlCharDescriptor,
  sqlVarcharDescriptor,
  sqlIntDescriptor,
  sqlFloatDescriptor,
  sqlTextDescriptor,
  sqlTimestampDescriptor,
  pgTextDescriptor,
  pgEnumDescriptor,
  pgCharDescriptor,
  pgVarcharDescriptor,
  pgIntDescriptor,
  pgFloatDescriptor,
  pgInt4Descriptor,
  pgInt2Descriptor,
  pgInt8Descriptor,
  pgFloat4Descriptor,
  pgFloat8Descriptor,
  pgNumericDescriptor,
  // PSL `Date` pins this codec by ID rather than activating a second target-type mapping.
  pgDateDescriptor,
  pgTimestampDescriptor,
  pgTimestamptzDescriptor,
  pgTimeDescriptor,
  pgTimetzDescriptor,
  pgBoolDescriptor,
  pgBitDescriptor,
  pgVarbitDescriptor,
  pgByteaDescriptor,
  pgUuidDescriptor,
  pgInetDescriptor,
  pgIntervalDescriptor,
  pgJsonDescriptor,
  pgJsonbDescriptor,
  pgTextArrayDescriptor,
];
