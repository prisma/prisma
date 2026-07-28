/**
 * Shared encode/decode/render constants for the Postgres target codecs.
 *
 * The codec implementations live in `codecs.ts` (TML-2357). This file retains the conversion helpers + emit-path type renderers that the codec methods compose with — keeping a single source of truth for non-trivial conversions while the codec methods provide the framework-required `Promise<…>` boundary.
 *
 * Trivial identity passthroughs are inlined directly in the codec methods; only conversions with shape (custom JSON round-trip, decode normalisation, parameterised renderers) live here.
 */

import type { JsonValue } from '@prisma-next/contract/types';
import { postgresError } from './errors';

export function renderLength(
  typeName: string,
  typeParams: Record<string, unknown>,
): string | undefined {
  const length = typeParams['length'];
  if (length === undefined) {
    return undefined;
  }
  if (typeof length !== 'number' || !Number.isFinite(length) || !Number.isInteger(length)) {
    throw postgresError(
      'RUNTIME.TYPE_PARAMS_INVALID',
      `renderOutputType: expected integer "length" in typeParams for ${typeName}, got ${String(length)}`,
      { meta: { nativeType: typeName, param: 'length', received: String(length) } },
    );
  }
  return `${typeName}<${length}>`;
}

export function renderPrecision(typeName: string, typeParams: Record<string, unknown>): string {
  const precision = typeParams['precision'];
  if (precision === undefined) {
    return typeName;
  }
  if (
    typeof precision !== 'number' ||
    !Number.isFinite(precision) ||
    !Number.isInteger(precision)
  ) {
    throw postgresError(
      'RUNTIME.TYPE_PARAMS_INVALID',
      `renderOutputType: expected integer "precision" in typeParams for ${typeName}, got ${String(precision)}`,
      { meta: { nativeType: typeName, param: 'precision', received: String(precision) } },
    );
  }
  return `${typeName}<${precision}>`;
}

export const pgNumericDecode = (wire: string | number): string => {
  if (typeof wire === 'number') return String(wire);
  return wire;
};

const DECIMAL_INTEGER = /^-?\d+$/;

/** Reads an `int8` wire or JSON value as a `bigint`, rejecting anything `BigInt()` would misread. */
export const pgInt8Decode = (wire: string | number | bigint): bigint => {
  if (typeof wire === 'bigint') return wire;
  const text = String(wire);
  if (!DECIMAL_INTEGER.test(text)) {
    throw postgresError('RUNTIME.DECODE_FAILED', 'pg/int8@1 value must be a decimal integer', {
      meta: { codecId: 'pg/int8@1', received: text },
    });
  }
  return BigInt(text);
};

/**
 * Renders an `int8` default as a `bigint` literal. The canonical JSON is decimal
 * text but the application type is `bigint`, so a plain string literal would not
 * typecheck against the emitted column type.
 */
export const pgInt8RenderValueLiteral = (value: JsonValue): string | undefined =>
  typeof value === 'string' && DECIMAL_INTEGER.test(value) ? `${value}n` : undefined;

export const pgNumericRenderOutputType = (typeParams: {
  readonly precision?: number;
  readonly scale?: number;
}): string | undefined => {
  const precision = typeParams.precision;
  if (precision === undefined) return undefined;
  if (
    typeof precision !== 'number' ||
    !Number.isFinite(precision) ||
    !Number.isInteger(precision)
  ) {
    throw postgresError(
      'RUNTIME.TYPE_PARAMS_INVALID',
      `renderOutputType: expected integer "precision" in typeParams for Numeric, got ${String(precision)}`,
      { meta: { nativeType: 'Numeric', param: 'precision', received: String(precision) } },
    );
  }
  const scale = typeParams.scale;
  if (scale === undefined) return `Numeric<${precision}>`;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || !Number.isInteger(scale)) {
    throw postgresError(
      'RUNTIME.TYPE_PARAMS_INVALID',
      `renderOutputType: expected integer "scale" in typeParams for Numeric, got ${String(scale)}`,
      { meta: { nativeType: 'Numeric', param: 'scale', received: String(scale) } },
    );
  }
  return `Numeric<${precision}, ${scale}>`;
};

const ISO_8601_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?$/;
const ISO_8601_TIMESTAMPTZ =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export const pgTimestampEncodeJson = (value: Date): JsonValue => value.toISOString().slice(0, -1);
export const pgTimestampDecodeJson = (json: JsonValue): Date => {
  if (typeof json !== 'string') {
    throw postgresError(
      'RUNTIME.DECODE_FAILED',
      `Expected ISO date string for pg/timestamp@1, got ${typeof json}`,
      { meta: { codecId: 'pg/timestamp@1', received: typeof json } },
    );
  }
  if (!ISO_8601_TIMESTAMP.test(json)) {
    throw postgresError(
      'RUNTIME.DECODE_FAILED',
      `Invalid ISO date string for pg/timestamp@1: ${json}`,
      { meta: { codecId: 'pg/timestamp@1', received: json } },
    );
  }
  const date = new Date(`${json}Z`);
  if (Number.isNaN(date.getTime())) {
    throw postgresError(
      'RUNTIME.DECODE_FAILED',
      `Invalid ISO date string for pg/timestamp@1: ${json}`,
      { meta: { codecId: 'pg/timestamp@1', received: json } },
    );
  }
  return date;
};

export const pgTimestamptzEncodeJson = (value: Date): JsonValue =>
  value.toISOString().replace(/Z$/, '+00:00');
export const pgTimestamptzDecodeJson = (json: JsonValue): Date => {
  if (typeof json !== 'string') {
    throw postgresError(
      'RUNTIME.DECODE_FAILED',
      `Expected ISO date string for pg/timestamptz@1, got ${typeof json}`,
      { meta: { codecId: 'pg/timestamptz@1', received: typeof json } },
    );
  }
  if (!ISO_8601_TIMESTAMPTZ.test(json)) {
    throw postgresError(
      'RUNTIME.DECODE_FAILED',
      `Invalid ISO date string for pg/timestamptz@1: ${json}`,
      { meta: { codecId: 'pg/timestamptz@1', received: json } },
    );
  }
  const date = new Date(json);
  if (Number.isNaN(date.getTime())) {
    throw postgresError(
      'RUNTIME.DECODE_FAILED',
      `Invalid ISO date string for pg/timestamptz@1: ${json}`,
      { meta: { codecId: 'pg/timestamptz@1', received: json } },
    );
  }
  return date;
};

const ISO_8601_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function formatDateOnly(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * A Postgres `date` has no time-of-day or timezone component, so `pg/date@1`
 * canonicalizes its JS-level value as a `Date` at UTC midnight
 * (`Date.UTC(y, m, d)`), independent of the process's local timezone.
 *
 * `pgDateEncode` reads the calendar date via UTC getters (matching that
 * canonical form) and formats it as `YYYY-MM-DD` directly, bypassing the pg
 * driver's own `Date` serialization (`dateToString`), which reads *local*
 * getters and would shift the calendar day near midnight in negative-UTC-offset
 * environments.
 */
export const pgDateEncode = (value: Date): string =>
  formatDateOnly(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());

/**
 * Normalizes the pg driver's already-parsed `Date` for a `date` column into
 * the canonical UTC-midnight form. The driver (via `postgres-date`) builds
 * that `Date` at *local* midnight from the wire text; reading it back with the
 * same (local) getters recovers the exact calendar date the driver parsed,
 * and reconstructing via `Date.UTC` makes the result's instant independent of
 * the process's timezone.
 */
export const pgDateDecode = (wire: Date): Date =>
  new Date(Date.UTC(wire.getFullYear(), wire.getMonth(), wire.getDate()));

export const pgDateEncodeJson = (value: Date): JsonValue => pgDateEncode(value);

export const pgDateDecodeJson = (json: JsonValue): Date => {
  if (typeof json !== 'string') {
    throw postgresError(
      'RUNTIME.DECODE_FAILED',
      `Expected date string for pg/date@1, got ${typeof json}`,
      { meta: { codecId: 'pg/date@1', received: typeof json } },
    );
  }
  const match = ISO_8601_DATE.exec(json);
  if (!match) {
    throw postgresError('RUNTIME.DECODE_FAILED', `Invalid date string for pg/date@1: ${json}`, {
      meta: { codecId: 'pg/date@1', received: json },
    });
  }
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    throw postgresError('RUNTIME.DECODE_FAILED', `Invalid date string for pg/date@1: ${json}`, {
      meta: { codecId: 'pg/date@1', received: json },
    });
  }
  return date;
};

export const pgIntervalDecode = (wire: string | Record<string, unknown>): string => {
  if (typeof wire === 'string') return wire;
  return JSON.stringify(wire);
};

export const pgByteaEncodeJson = (value: Uint8Array): JsonValue =>
  `\\x${Buffer.from(value).toString('hex')}`;

export const pgByteaDecodeJson = (value: JsonValue): Uint8Array => {
  if (typeof value !== 'string' || !value.startsWith('\\x')) {
    throw postgresError(
      'RUNTIME.DECODE_FAILED',
      `Expected Postgres bytea hex text to start with "\\x"`,
      { meta: { codecId: 'pg/bytea@1' } },
    );
  }

  const hex = value.slice(2);
  if (hex.length % 2 !== 0) {
    throw postgresError(
      'RUNTIME.DECODE_FAILED',
      `Invalid Postgres bytea hex text length: ${hex.length}`,
      { meta: { codecId: 'pg/bytea@1', received: hex.length } },
    );
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let offset = 0; offset < hex.length; offset += 2) {
    const pair = hex.slice(offset, offset + 2);
    if (!/^[0-9a-fA-F]{2}$/.test(pair)) {
      throw postgresError(
        'RUNTIME.DECODE_FAILED',
        `Invalid Postgres bytea hex pair "${pair}" at offset ${offset}`,
        { meta: { codecId: 'pg/bytea@1', received: pair } },
      );
    }
    bytes[offset / 2] = Number.parseInt(pair, 16);
  }
  return bytes;
};

export const pgJsonEncode = (value: string | JsonValue): string => JSON.stringify(value);
export const pgJsonDecode = (wire: string | JsonValue): JsonValue =>
  typeof wire === 'string' ? JSON.parse(wire) : wire;

export const pgJsonbEncode = (value: string | JsonValue): string => JSON.stringify(value);
export const pgJsonbDecode = (wire: string | JsonValue): JsonValue =>
  typeof wire === 'string' ? JSON.parse(wire) : wire;
