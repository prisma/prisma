/**
 * Shared encode/decode/render constants and codec id literals for the six SQL base codecs (`sql/char@1`, `sql/varchar@1`, `sql/int@1`, `sql/float@1`, `sql/text@1`, `sql/timestamp@1`).
 *
 * The codec implementations live in `sql-codecs.ts` (TML-2357). This module retains only the conversion helpers + emit-path renderers the codec methods compose with — keeping a single source of truth for non-trivial conversions while the codec methods provide the framework-required `Promise<…>` boundary.
 */

import type { JsonValue } from '@internal/contract/types';
import { structuredError } from '@internal/utils/structured-error';

export const SQL_CHAR_CODEC_ID = 'sql/char@1' as const;
export const SQL_VARCHAR_CODEC_ID = 'sql/varchar@1' as const;
export const SQL_INT_CODEC_ID = 'sql/int@1' as const;
export const SQL_FLOAT_CODEC_ID = 'sql/float@1' as const;
export const SQL_TEXT_CODEC_ID = 'sql/text@1' as const;
export const SQL_TIMESTAMP_CODEC_ID = 'sql/timestamp@1' as const;

export const sqlCharEncode = (value: string): string => value;
export const sqlCharDecode = (wire: string): string => wire.trimEnd();
export const sqlCharRenderOutputType = (typeParams: { readonly length?: number }) => {
  const length = typeParams.length;
  if (length === undefined) return undefined;
  if (typeof length !== 'number' || !Number.isFinite(length) || !Number.isInteger(length)) {
    throw structuredError(
      'RUNTIME.TYPE_PARAMS_INVALID',
      `renderOutputType: expected integer "length" in typeParams for Char, got ${String(length)}`,
      { meta: { codec: SQL_CHAR_CODEC_ID, param: 'length', received: String(length) } },
    );
  }
  return `Char<${length}>`;
};

export const sqlVarcharEncode = (value: string): string => value;
export const sqlVarcharDecode = (wire: string): string => wire;
export const sqlVarcharRenderOutputType = (typeParams: { readonly length?: number }) => {
  const length = typeParams.length;
  if (length === undefined) return undefined;
  if (typeof length !== 'number' || !Number.isFinite(length) || !Number.isInteger(length)) {
    throw structuredError(
      'RUNTIME.TYPE_PARAMS_INVALID',
      `renderOutputType: expected integer "length" in typeParams for Varchar, got ${String(length)}`,
      { meta: { codec: SQL_VARCHAR_CODEC_ID, param: 'length', received: String(length) } },
    );
  }
  return `Varchar<${length}>`;
};

export const sqlIntEncode = (value: number): number => value;
export const sqlIntDecode = (wire: number): number => wire;

export const sqlFloatEncode = (value: number): number => value;
export const sqlFloatDecode = (wire: number): number => wire;

/**
 * JSON has no spelling for a non-finite number, and a database that holds one
 * emits it as a string — PostgreSQL writes `"NaN"` and `"Infinity"`. This
 * codec's application type is `number`, so both directions reject rather than
 * carry a value that type cannot hold.
 */
export const sqlFloatEncodeJson = (value: number): JsonValue => {
  if (!Number.isFinite(value)) {
    throw structuredError(
      'RUNTIME.ENCODE_FAILED',
      `${SQL_FLOAT_CODEC_ID} application value must be a finite number, got ${value}`,
      { meta: { codec: SQL_FLOAT_CODEC_ID } },
    );
  }
  return value;
};

export const sqlFloatDecodeJson = (json: JsonValue): number => {
  if (typeof json !== 'number' || !Number.isFinite(json)) {
    throw structuredError(
      'RUNTIME.DECODE_FAILED',
      `Expected a finite number for ${SQL_FLOAT_CODEC_ID}, got ${JSON.stringify(json)}`,
      { meta: { codec: SQL_FLOAT_CODEC_ID } },
    );
  }
  return json;
};

export const sqlTextEncode = (value: string): string => value;
export const sqlTextDecode = (wire: string): string => wire;

const ZONELESS_ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/;

export const sqlTimestampEncode = (value: Date): Date => value;
export const sqlTimestampDecode = (wire: Date): Date => wire;
/**
 * A `timestamp` carries no zone, so its JSON form is the ISO rendering without a
 * trailing `Z` — `2026-01-02T03:04:05.678` — and {@link sqlTimestampDecodeJson}
 * reads that form back as UTC.
 */
export const sqlTimestampEncodeJson = (value: Date): JsonValue => value.toISOString().slice(0, -1);
export const sqlTimestampDecodeJson = (json: JsonValue): Date => {
  if (typeof json !== 'string') {
    throw structuredError(
      'RUNTIME.DECODE_FAILED',
      `Expected ISO date string for sql/timestamp@1, got ${typeof json}`,
      { meta: { codec: SQL_TIMESTAMP_CODEC_ID } },
    );
  }
  // Only the zone-less canonical form is accepted. An offset-bearing string is
  // rejected rather than reinterpreted: this codec cannot reproduce an offset,
  // so accepting one would decode a value it could never encode back.
  if (!ZONELESS_ISO_TIMESTAMP.test(json)) {
    throw structuredError(
      'RUNTIME.DECODE_FAILED',
      `Expected a zone-less ISO date-time (YYYY-MM-DDTHH:MM:SS[.sss]) for sql/timestamp@1, got ${json}`,
      { meta: { codec: SQL_TIMESTAMP_CODEC_ID } },
    );
  }
  // Resolved as UTC; `new Date` would otherwise read the zone-less form in the
  // process's local zone and shift the instant.
  const date = new Date(`${json}Z`);
  if (Number.isNaN(date.getTime())) {
    throw structuredError(
      'RUNTIME.DECODE_FAILED',
      `Invalid ISO date string for sql/timestamp@1: ${json}`,
      { meta: { codec: SQL_TIMESTAMP_CODEC_ID } },
    );
  }
  return date;
};
export const sqlTimestampRenderOutputType = (typeParams: { readonly precision?: number }) => {
  const precision = typeParams.precision;
  if (precision === undefined) {
    return 'Timestamp';
  }
  if (
    typeof precision !== 'number' ||
    !Number.isFinite(precision) ||
    !Number.isInteger(precision)
  ) {
    throw structuredError(
      'RUNTIME.TYPE_PARAMS_INVALID',
      `renderOutputType: expected integer "precision" in typeParams for Timestamp, got ${String(precision)}`,
      { meta: { codec: SQL_TIMESTAMP_CODEC_ID, param: 'precision', received: String(precision) } },
    );
  }
  return `Timestamp<${precision}>`;
};
