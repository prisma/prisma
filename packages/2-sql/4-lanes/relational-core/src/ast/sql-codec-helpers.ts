/**
 * Shared encode/decode/render constants and codec id literals for the six SQL base codecs (`sql/char@1`, `sql/varchar@1`, `sql/int@1`, `sql/float@1`, `sql/text@1`, `sql/timestamp@1`).
 *
 * The codec implementations live in `sql-codecs.ts` (TML-2357). This module retains only the conversion helpers + emit-path renderers the codec methods compose with — keeping a single source of truth for non-trivial conversions while the codec methods provide the framework-required `Promise<…>` boundary.
 */

import type { JsonValue } from '@prisma-next/contract/types';
import { structuredError } from '@prisma-next/utils/structured-error';

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

export const sqlTextEncode = (value: string): string => value;
export const sqlTextDecode = (wire: string): string => wire;

export const sqlTimestampEncode = (value: Date): Date => value;
export const sqlTimestampDecode = (wire: Date): Date => wire;
/**
 * A `timestamp` column carries no zone, so its JSON form is the ISO rendering
 * without a trailing `Z` — the shape the database itself produces for the
 * column, and the shape {@link sqlTimestampDecodeJson} reads back as UTC.
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
  // The zone-less form is resolved as UTC; `new Date` would otherwise read it in
  // the process's local zone and shift the instant.
  const date = new Date(json.endsWith('Z') ? json : `${json}Z`);
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
