/**
 * Native SQLite target codecs (TML-2357). Mirrors the Postgres codec class form in `packages/3-targets/3-targets/postgres/src/core/codecs.ts`.
 *
 * Each codec ships as three artifacts:
 *
 * 1. A `SqliteXCodec` class extending {@link CodecImpl} that wraps the encode/decode/encodeJson/decodeJson conversions inline. SQLite's runtime conversions are simple enough that there is no shared helper module; the class bodies are the single source of truth. 2. A `SqliteXDescriptor` class extending {@link SqliteCodecDescriptor} declaring the codec id, traits, target types, params schema, and current scalar JSON projection. SQLite codecs do not carry
 * `meta` (no per-target native-type meta today) and are all non-parameterized. 3. A per-codec column helper (`sqliteXColumn`) that calls `descriptor.factory()` directly and packages the result into a {@link ColumnSpec} via the framework {@link column} packager. The helper is tied to its descriptor with `satisfies ColumnHelperFor` + `ColumnHelperForStrict` (every SQLite codec's resolved type is well-defined).
 *
 * After TML-2357 this is the canonical source of SQLite codec metadata and runtime behaviour — the legacy `mkCodec` / `defineCodec` carriers (and the parallel `byScalar` / `codecDescriptorDefinitions` collection exports) retired with the deletion sweep.
 *
 * Audit: every SQLite codec is non-parameterized and parameter-stateless; `factory()` takes no params (`P = void`) and returns a fresh codec constructed solely from `this`.
 */

import type { JsonValue } from '@prisma-next/contract/types';
import {
  type CodecCallContext,
  CodecImpl,
  type CodecInstanceContext,
  type ColumnHelperFor,
  type ColumnHelperForStrict,
  column,
  voidParamsSchema,
} from '@prisma-next/framework-components/codec';
import {
  CastExpr,
  FunctionCallExpr,
  type ProjectionExpr,
  sqlCharDescriptor,
  sqlFloatDescriptor,
  sqlIntDescriptor,
  sqlVarcharDescriptor,
} from '@prisma-next/sql-relational-core/ast';
import { defineSqliteCodecs, SqliteCodecDescriptor, sqliteCodec } from './codec-descriptor';
import {
  SQLITE_BIGINT_CODEC_ID,
  SQLITE_BLOB_CODEC_ID,
  SQLITE_DATETIME_CODEC_ID,
  SQLITE_INTEGER_CODEC_ID,
  SQLITE_JSON_CODEC_ID,
  SQLITE_REAL_CODEC_ID,
  SQLITE_TEXT_CODEC_ID,
} from './codec-ids';
import { sqliteError } from './errors';

/**
 * Projects the expression unchanged, for codecs whose canonical JSON is what
 * SQLite's own JSON conversion already produces.
 *
 * Identity here is a claim about the target's behaviour, not an absence of one:
 * the codec's conformance cases are what test it, including at the boundaries
 * of the representation where a native conversion would be most likely to
 * diverge.
 */
const identityJsonProjection = (expression: ProjectionExpr): ProjectionExpr => expression;

/**
 * Projects an integer-valued expression as decimal text.
 *
 * The cast is part of the projected expression, so it applies before the JSON
 * constructor sees the value: handed an INTEGER directly, the constructor emits
 * a JSON number, and SQLite's 64-bit range does not survive being read back as
 * a double. Casting the constructor's result would be too late.
 */
const decimalTextJsonProjection = (expression: ProjectionExpr): ProjectionExpr =>
  CastExpr.as(expression, 'TEXT');

/**
 * Projects a BLOB as hexadecimal text.
 *
 * SQLite's JSON functions reject a BLOB argument outright, so the encoding has
 * to replace the native conversion rather than post-process it. `hex()` emits
 * uppercase and never wraps at any length, which is the spelling `encodeJson`
 * pins.
 */
const hexJsonProjection = (expression: ProjectionExpr): ProjectionExpr =>
  FunctionCallExpr.of('hex', [expression]);

const DECIMAL_INTEGER = /^-?\d+$/;
const UPPERCASE_HEX = /^(?:[0-9A-F]{2})*$/;

/**
 * JSON has no spelling for an infinity or a NaN, and SQLite renders one as
 * `9.0e+999`, which reads back as `Infinity` rather than failing. A real is
 * therefore carried only where it is finite.
 */
const finiteReal = (value: number, code: 'RUNTIME.ENCODE_FAILED' | 'RUNTIME.DECODE_FAILED') => {
  if (!Number.isFinite(value)) {
    throw sqliteError(code, 'sqlite/real@1 value must be a finite number', {
      meta: { codecId: SQLITE_REAL_CODEC_ID, received: String(value) },
    });
  }
  return value;
};

export const sqliteSqlCharDescriptor = sqliteCodec(sqlCharDescriptor, {
  jsonProjection: identityJsonProjection,
});

export const sqliteSqlVarcharDescriptor = sqliteCodec(sqlVarcharDescriptor, {
  jsonProjection: identityJsonProjection,
});

export const sqliteSqlIntDescriptor = sqliteCodec(sqlIntDescriptor, {
  jsonProjection: identityJsonProjection,
});

export const sqliteSqlFloatDescriptor = sqliteCodec(sqlFloatDescriptor, {
  jsonProjection: identityJsonProjection,
});

export class SqliteTextCodec extends CodecImpl<
  typeof SQLITE_TEXT_CODEC_ID,
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

export class SqliteTextDescriptor extends SqliteCodecDescriptor<void> {
  protected override jsonProjection(expression: ProjectionExpr): ProjectionExpr {
    return expression;
  }
  override readonly codecId = SQLITE_TEXT_CODEC_ID;
  override readonly traits = ['equality', 'order', 'textual'] as const;
  override readonly targetTypes = ['text'] as const;
  override readonly paramsSchema = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => SqliteTextCodec {
    return () => new SqliteTextCodec(this);
  }
}

export const sqliteTextDescriptor = new SqliteTextDescriptor();

export const sqliteTextColumn = () =>
  column(sqliteTextDescriptor.factory(), sqliteTextDescriptor.codecId, undefined, 'text');

sqliteTextColumn satisfies ColumnHelperFor<SqliteTextDescriptor>;
sqliteTextColumn satisfies ColumnHelperForStrict<SqliteTextDescriptor>;

export class SqliteIntegerCodec extends CodecImpl<
  typeof SQLITE_INTEGER_CODEC_ID,
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

export class SqliteIntegerDescriptor extends SqliteCodecDescriptor<void> {
  protected override jsonProjection(expression: ProjectionExpr): ProjectionExpr {
    return expression;
  }
  override readonly codecId = SQLITE_INTEGER_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly targetTypes = ['integer'] as const;
  override readonly paramsSchema = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => SqliteIntegerCodec {
    return () => new SqliteIntegerCodec(this);
  }
}

export const sqliteIntegerDescriptor = new SqliteIntegerDescriptor();

export const sqliteIntegerColumn = () =>
  column(sqliteIntegerDescriptor.factory(), sqliteIntegerDescriptor.codecId, undefined, 'integer');

sqliteIntegerColumn satisfies ColumnHelperFor<SqliteIntegerDescriptor>;
sqliteIntegerColumn satisfies ColumnHelperForStrict<SqliteIntegerDescriptor>;

export class SqliteRealCodec extends CodecImpl<
  typeof SQLITE_REAL_CODEC_ID,
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
    return finiteReal(value, 'RUNTIME.ENCODE_FAILED');
  }
  decodeJson(json: JsonValue): number {
    if (typeof json !== 'number') {
      throw sqliteError(
        'RUNTIME.DECODE_FAILED',
        'sqlite/real@1 database JSON value must be a number',
        {
          meta: { codecId: SQLITE_REAL_CODEC_ID, received: typeof json },
        },
      );
    }
    return finiteReal(json, 'RUNTIME.DECODE_FAILED');
  }
}

export class SqliteRealDescriptor extends SqliteCodecDescriptor<void> {
  protected override jsonProjection(expression: ProjectionExpr): ProjectionExpr {
    return expression;
  }
  override readonly codecId = SQLITE_REAL_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly targetTypes = ['real'] as const;
  override readonly paramsSchema = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => SqliteRealCodec {
    return () => new SqliteRealCodec(this);
  }
}

export const sqliteRealDescriptor = new SqliteRealDescriptor();

export const sqliteRealColumn = () =>
  column(sqliteRealDescriptor.factory(), sqliteRealDescriptor.codecId, undefined, 'real');

sqliteRealColumn satisfies ColumnHelperFor<SqliteRealDescriptor>;
sqliteRealColumn satisfies ColumnHelperForStrict<SqliteRealDescriptor>;

export class SqliteBlobCodec extends CodecImpl<
  typeof SQLITE_BLOB_CODEC_ID,
  readonly ['equality'],
  Uint8Array,
  Uint8Array
> {
  async encode(value: Uint8Array, _ctx: CodecCallContext): Promise<Uint8Array> {
    return value;
  }
  async decode(wire: Uint8Array, _ctx: CodecCallContext): Promise<Uint8Array> {
    return wire;
  }
  encodeJson(value: Uint8Array): JsonValue {
    return Buffer.from(value).toString('hex').toUpperCase();
  }
  decodeJson(json: JsonValue): Uint8Array {
    if (typeof json !== 'string' || !UPPERCASE_HEX.test(json)) {
      throw sqliteError(
        'RUNTIME.DECODE_FAILED',
        'sqlite/blob@1 database JSON value must be uppercase hexadecimal text',
        { meta: { codecId: SQLITE_BLOB_CODEC_ID, received: typeof json } },
      );
    }
    return new Uint8Array(Buffer.from(json, 'hex'));
  }
}

export class SqliteBlobDescriptor extends SqliteCodecDescriptor<void> {
  protected override jsonProjection(expression: ProjectionExpr): ProjectionExpr {
    return hexJsonProjection(expression);
  }
  override readonly codecId = SQLITE_BLOB_CODEC_ID;
  override readonly traits = ['equality'] as const;
  override readonly targetTypes = ['blob'] as const;
  override readonly paramsSchema = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => SqliteBlobCodec {
    return () => new SqliteBlobCodec(this);
  }
}

export const sqliteBlobDescriptor = new SqliteBlobDescriptor();

export const sqliteBlobColumn = () =>
  column(sqliteBlobDescriptor.factory(), sqliteBlobDescriptor.codecId, undefined, 'blob');

sqliteBlobColumn satisfies ColumnHelperFor<SqliteBlobDescriptor>;
sqliteBlobColumn satisfies ColumnHelperForStrict<SqliteBlobDescriptor>;

export class SqliteDatetimeCodec extends CodecImpl<
  typeof SQLITE_DATETIME_CODEC_ID,
  readonly ['equality', 'order'],
  string,
  Date
> {
  // Reject `Invalid Date` (NaN-time) at every decode ingress so consumers never receive a Date object whose downstream operations silently produce NaN. Mirrors the stricter ISO-8601 validation on the postgres timestamp helpers.
  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw sqliteError(
        'RUNTIME.DECODE_FAILED',
        `sqlite/datetime@1 value must be a valid ISO-8601 string: ${value}`,
        { meta: { codecId: SQLITE_DATETIME_CODEC_ID, received: value } },
      );
    }
    return date;
  }
  async encode(value: Date, _ctx: CodecCallContext): Promise<string> {
    return value.toISOString();
  }
  async decode(wire: string, _ctx: CodecCallContext): Promise<Date> {
    return this.parseDate(wire);
  }
  encodeJson(value: Date): JsonValue {
    return value.toISOString();
  }
  decodeJson(json: JsonValue): Date {
    if (typeof json !== 'string') {
      throw sqliteError(
        'RUNTIME.DECODE_FAILED',
        'sqlite/datetime@1 contract value must be an ISO-8601 string',
        { meta: { codecId: SQLITE_DATETIME_CODEC_ID, received: typeof json } },
      );
    }
    return this.parseDate(json);
  }
}

export class SqliteDatetimeDescriptor extends SqliteCodecDescriptor<void> {
  protected override jsonProjection(expression: ProjectionExpr): ProjectionExpr {
    return expression;
  }
  override readonly codecId = SQLITE_DATETIME_CODEC_ID;
  override readonly traits = ['equality', 'order'] as const;
  override readonly targetTypes = ['text'] as const;
  override readonly paramsSchema = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => SqliteDatetimeCodec {
    return () => new SqliteDatetimeCodec(this);
  }
}

export const sqliteDatetimeDescriptor = new SqliteDatetimeDescriptor();

export const sqliteDatetimeColumn = () =>
  column(sqliteDatetimeDescriptor.factory(), sqliteDatetimeDescriptor.codecId, undefined, 'text');

sqliteDatetimeColumn satisfies ColumnHelperFor<SqliteDatetimeDescriptor>;
sqliteDatetimeColumn satisfies ColumnHelperForStrict<SqliteDatetimeDescriptor>;

export class SqliteJsonCodec extends CodecImpl<
  typeof SQLITE_JSON_CODEC_ID,
  readonly ['equality'],
  string | JsonValue,
  JsonValue
> {
  async encode(value: JsonValue, _ctx: CodecCallContext): Promise<string> {
    return JSON.stringify(value);
  }
  async decode(wire: string | JsonValue, _ctx: CodecCallContext): Promise<JsonValue> {
    return typeof wire === 'string' ? (JSON.parse(wire) as JsonValue) : wire;
  }
  encodeJson(value: JsonValue): JsonValue {
    return value;
  }
  decodeJson(json: JsonValue): JsonValue {
    return json;
  }
}

export class SqliteJsonDescriptor extends SqliteCodecDescriptor<void> {
  protected override jsonProjection(expression: ProjectionExpr): ProjectionExpr {
    return expression;
  }
  override readonly codecId = SQLITE_JSON_CODEC_ID;
  override readonly traits = ['equality'] as const;
  override readonly targetTypes = ['text'] as const;
  override readonly paramsSchema = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => SqliteJsonCodec {
    return () => new SqliteJsonCodec(this);
  }
}

export const sqliteJsonDescriptor = new SqliteJsonDescriptor();

export const sqliteJsonColumn = () =>
  column(sqliteJsonDescriptor.factory(), sqliteJsonDescriptor.codecId, undefined, 'text');

sqliteJsonColumn satisfies ColumnHelperFor<SqliteJsonDescriptor>;
sqliteJsonColumn satisfies ColumnHelperForStrict<SqliteJsonDescriptor>;

export class SqliteBigintCodec extends CodecImpl<
  typeof SQLITE_BIGINT_CODEC_ID,
  readonly ['equality', 'order', 'numeric'],
  number | bigint,
  bigint
> {
  async encode(value: bigint, _ctx: CodecCallContext): Promise<number | bigint> {
    return value;
  }
  async decode(wire: number | bigint, _ctx: CodecCallContext): Promise<bigint> {
    return BigInt(wire);
  }
  encodeJson(value: bigint): JsonValue {
    return value.toString();
  }
  decodeJson(json: JsonValue): bigint {
    if (typeof json !== 'string' || !DECIMAL_INTEGER.test(json)) {
      throw sqliteError(
        'RUNTIME.DECODE_FAILED',
        'sqlite/bigint@1 database JSON value must be a decimal string',
        { meta: { codecId: SQLITE_BIGINT_CODEC_ID, received: typeof json } },
      );
    }
    return BigInt(json);
  }
}

export class SqliteBigintDescriptor extends SqliteCodecDescriptor<void> {
  protected override jsonProjection(expression: ProjectionExpr): ProjectionExpr {
    return decimalTextJsonProjection(expression);
  }
  override readonly codecId = SQLITE_BIGINT_CODEC_ID;
  override readonly traits = ['equality', 'order', 'numeric'] as const;
  override readonly targetTypes = ['integer'] as const;
  override readonly paramsSchema = voidParamsSchema;
  override factory(): (ctx: CodecInstanceContext) => SqliteBigintCodec {
    return () => new SqliteBigintCodec(this);
  }
}

export const sqliteBigintDescriptor = new SqliteBigintDescriptor();

export const sqliteBigintColumn = () =>
  column(sqliteBigintDescriptor.factory(), sqliteBigintDescriptor.codecId, undefined, 'integer');

sqliteBigintColumn satisfies ColumnHelperFor<SqliteBigintDescriptor>;
sqliteBigintColumn satisfies ColumnHelperForStrict<SqliteBigintDescriptor>;

export const codecDescriptors = defineSqliteCodecs([
  sqliteSqlCharDescriptor,
  sqliteSqlVarcharDescriptor,
  sqliteSqlIntDescriptor,
  sqliteSqlFloatDescriptor,
  sqliteTextDescriptor,
  sqliteIntegerDescriptor,
  sqliteRealDescriptor,
  sqliteBlobDescriptor,
  sqliteDatetimeDescriptor,
  sqliteJsonDescriptor,
  sqliteBigintDescriptor,
]);
