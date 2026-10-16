/**
 * How `contract infer` reads a reported default: by the column's native type, into the JSON a contract stores. Introspection reads a default with the column's codec instead (`readPostgresDefault`); `contract infer`, which has no contract to take a codec from, reads it here.
 */

import type { ColumnDefault, JsonValue } from '@internal/contract/types';
import { canonicalNumeralText } from '@internal/sql-contract/data-type-support';
import { blindCast } from '@internal/utils/casts';
import { isStructuredError } from '@internal/utils/structured-error';
import { canonicalInet } from '../canonical-inet';
import { canonicalUuid, pgIntervalCanonical } from '../codec-helpers';
import {
  pgDateCanonical,
  pgTimeCanonical,
  pgTimestampCanonical,
  pgTimestamptzCanonical,
  pgTimetzCanonical,
} from '../data-types';
import {
  ARRAY_CONSTRUCTOR_PATTERN,
  ARRAY_LITERAL_PATTERN,
  canonicalizeTimestampDefault,
  FALSE_PATTERN,
  NEXTVAL_PATTERN,
  NULL_PATTERN,
  NUMBER_TYPE_PATTERN,
  NUMERIC_PATTERN,
  readLiteralToken,
  SEMICOLON_DELIMITED_ELEMENT_TYPE_PATTERN,
  splitArrayElements,
  splitConstructorElements,
  TRUE_PATTERN,
  TYPE_MODIFIER,
  UUID_OSSP_PATTERN,
  UUID_PATTERN,
  unwrapOuterArrayCasts,
} from '../default-normalizer';

const DECIMAL_TEXT_TYPE_PATTERN = new RegExp(
  `^(?:bigint|int8|numeric|decimal)(?:${TYPE_MODIFIER})?$`,
  'i',
);

/**
 * `int8` and `numeric` defaults are decimal text, the JSON form of their codecs, so no digit is
 * lost to a JavaScript number. A column that is not a number type stores the numeral as text.
 */
function numberValue(numeral: string, nativeType: string | undefined): JsonValue | undefined {
  if (nativeType !== undefined && DECIMAL_TEXT_TYPE_PATTERN.test(nativeType)) {
    return storedText(numeral, nativeType);
  }
  if (nativeType !== undefined && !NUMBER_TYPE_PATTERN.test(nativeType)) return numeral;
  const parsed = Number(numeral);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const BOOLEAN_TYPE_PATTERN = /^(?:bool|boolean)$/i;
const BOOLEAN_TRUE_TOKEN_PATTERN = /^(?:t|true)$/i;
const BOOLEAN_FALSE_TOKEN_PATTERN = /^(?:f|false)$/i;

const BYTEA_HEX_INPUT = /^\\x((?:[ \t\n\r]*[0-9A-Fa-f]{2})*)[ \t\n\r]*$/;
const BYTEA_ESCAPE_TOKEN = /\\\\|\\[0-3][0-7]{2}|[^\\]+|\\/g;

function byteaEscapeTokenBytes(token: string): Buffer | undefined {
  if (token === '\\\\') return Buffer.from('\\');
  if (token === '\\') return undefined;
  if (token.startsWith('\\')) return Buffer.from([Number.parseInt(token.slice(1), 8)]);
  return Buffer.from(token, 'utf8');
}

/**
 * The bytes of `bytea` input text, as the base64 the codec stores, or `undefined` for text
 * PostgreSQL refuses. Text starting `\x` is hex, two digits for each byte. Any other text is the
 * escape format: `\\` is a backslash, `\` and three octal digits is that byte, and any other
 * character is its UTF-8 bytes.
 */
function byteaInputBase64(text: string): string | undefined {
  const hex = BYTEA_HEX_INPUT.exec(text)?.[1];
  if (hex !== undefined) return Buffer.from(hex.replace(/\s/g, ''), 'hex').toString('base64');
  if (text.startsWith('\\x')) return undefined;
  const chunks: Buffer[] = [];
  for (const [token] of text.matchAll(BYTEA_ESCAPE_TOKEN)) {
    const bytes = byteaEscapeTokenBytes(token);
    if (bytes === undefined) return undefined;
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString('base64');
}

const DATE_TIME_TYPE = /^(date|time|timetz|timestamp|timestamptz|interval)(?:\(\d+\))?$/;

const DATE_TIME_TEXT: Readonly<Record<string, (text: string) => string>> = {
  date: pgDateCanonical,
  time: pgTimeCanonical,
  timetz: pgTimetzCanonical,
  timestamp: pgTimestampCanonical,
  timestamptz: pgTimestamptzCanonical,
  interval: pgIntervalCanonical,
};

/** A date or time default in the form a contract stores, or the text as reported when the type does not read it. */
function storedDateTimeText(text: string, nativeType: string): string | undefined {
  const toStored = DATE_TIME_TEXT[DATE_TIME_TYPE.exec(nativeType)?.[1] ?? ''];
  if (toStored === undefined) return undefined;
  try {
    return toStored(text);
  } catch (error) {
    if (isStructuredError(error)) return text;
    throw error;
  }
}

/**
 * A text default as the column stores it: a uuid, an IP address or the numeral of an int8 or numeric
 * in the form PostgreSQL writes, which its codec reads, a date or time in the form a contract stores it, and a bytea as the base64 of its bytes.
 * `undefined` for bytea text PostgreSQL refuses.
 */
function storedText(text: string, nativeType: string | undefined): string | undefined {
  if (nativeType === 'bytea') return byteaInputBase64(text);
  if (nativeType === 'uuid') return canonicalUuid(text) ?? text;
  if (nativeType === 'inet') return canonicalInet(text) ?? text;
  if (nativeType !== undefined && DECIMAL_TEXT_TYPE_PATTERN.test(nativeType)) {
    return canonicalNumeralText(text);
  }
  return (nativeType === undefined ? undefined : storedDateTimeText(text, nativeType)) ?? text;
}

/**
 * Reads an unquoted, non-NULL array element by the column's element type. Only text Postgres itself
 * would print is read; anything else keeps the raw expression.
 */
function unquotedElementValue(token: string, elementType: string): JsonValue | undefined {
  if (token === '') return undefined;
  if (BOOLEAN_TYPE_PATTERN.test(elementType)) {
    if (BOOLEAN_TRUE_TOKEN_PATTERN.test(token)) return true;
    if (BOOLEAN_FALSE_TOKEN_PATTERN.test(token)) return false;
    return undefined;
  }
  if (NUMBER_TYPE_PATTERN.test(elementType)) {
    return NUMERIC_PATTERN.test(token) ? numberValue(token, elementType) : undefined;
  }
  if (isJsonElementType(elementType)) {
    const document = readJsonDocument(token);
    return document.kind === 'json' ? document.value : undefined;
  }
  return storedText(token, elementType);
}

/**
 * Parses a Postgres array literal body (`{...}`) into a JS array of primitives.
 * Returns undefined if the body cannot be reliably parsed.
 *
 * Handles:
 * - `{}` → `[]`
 * - `{elem1,elem2,...}` → `[elem1, elem2, ...]`, each unquoted element read by the element type
 * - quoted elements that contain commas, doubled/escaped quotes, and the literal
 *   strings `NULL`/`true`/`false` (a quoted token is always a string)
 */
function parseArrayLiteralBody(
  body: string,
  elementType: string,
): readonly JsonValue[] | undefined {
  const inner = body.slice(1, -1).trim();
  if (inner === '') return [];
  const tokens = splitArrayElements(inner);
  if (tokens === undefined) return undefined;
  const result: JsonValue[] = [];
  for (const token of tokens) {
    if (token.quoted) {
      // A quoted token is always a string — `"NULL"`, `"true"`, `"1"` are the
      // literal text, never the keyword/number.
      const value = textElementValue(token.value, elementType);
      if (value === undefined) return undefined;
      result.push(value);
      continue;
    }
    const el = token.value.trim();
    if (el.toUpperCase() === 'NULL') {
      // A `json`/`jsonb` element's quoted `'null'` is the JSON value null, and an unquoted SQL NULL
      // is the absence of a value. Both would read back as JSON null, so the whole default is left
      // as its raw expression rather than printed as one the other reads back as.
      if (isJsonElementType(elementType)) return undefined;
      result.push(null);
      continue;
    }
    const value = unquotedElementValue(el, elementType);
    if (value === undefined) return undefined;
    result.push(value);
  }
  return result;
}

/**
 * Reads one `ARRAY[...]` element: NULL, a boolean, or a literal read by its cast type. Anything
 * else, such as a function call, means the constructor is not a literal and the caller keeps the
 * raw expression.
 */
function parseConstructorElement(element: string, elementType: string): JsonValue | undefined {
  // See `parseArrayLiteralBody`: an unquoted SQL NULL in a json list is not the JSON value null.
  if (NULL_PATTERN.test(element)) return isJsonElementType(elementType) ? undefined : null;
  if (TRUE_PATTERN.test(element)) return true;
  if (FALSE_PATTERN.test(element)) return false;
  const token = readLiteralToken(element);
  if (token === undefined) return undefined;
  return token.kind === 'number'
    ? numberValue(token.numeral, elementType)
    : textElementValue(token.text, elementType);
}

function isJsonElementType(elementType: string): boolean {
  return elementType === 'json' || elementType === 'jsonb';
}

/**
 * A `json`/`jsonb` element's text is a JSON document, as it is on a scalar column of the same type.
 * Undefined keeps the raw expression: the document holds a number a JavaScript number would change.
 */
function textElementValue(text: string, elementType: string): JsonValue | undefined {
  if (!isJsonElementType(elementType)) return storedText(text, elementType);
  const document = readJsonDocument(text);
  if (document.kind === 'inexact') return undefined;
  return document.kind === 'json' ? document.value : text;
}

type JsonDocument =
  | { readonly kind: 'json'; readonly value: JsonValue }
  | { readonly kind: 'inexact' }
  | { readonly kind: 'invalid' };

type JsonReviver = (key: string, value: unknown, context?: { readonly source?: string }) => unknown;

/**
 * Parses JSON text. Postgres keeps every digit of a json number, so a document holding a number that
 * would not print back as the same value once read into a JavaScript number, such as
 * `12345678901234567890` or `1e400`, is `inexact`. `1.0` prints back as `1`, the same value.
 */
function readJsonDocument(text: string): JsonDocument {
  let exact = true;
  const reviver: JsonReviver = (_key, value, context) => {
    if (typeof value === 'number' && !keepsJsonNumber(value, context?.source)) exact = false;
    return value;
  };
  let value: JsonValue;
  try {
    value = blindCast<JsonValue, 'JSON.parse yields a JSON value'>(JSON.parse(text, reviver));
  } catch {
    return { kind: 'invalid' };
  }
  return exact ? { kind: 'json', value } : { kind: 'inexact' };
}

function keepsJsonNumber(value: number, source: string | undefined): boolean {
  if (!Number.isFinite(value) || source === undefined) return false;
  const written = decimalValue(source);
  return written !== undefined && written === decimalValue(String(value));
}

const DECIMAL_PARTS_PATTERN = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

/** A numeral's value as `<sign><digits>e<exponent>`, with no leading or trailing zero digits. */
function decimalValue(numeral: string): string | undefined {
  const parts = DECIMAL_PARTS_PATTERN.exec(numeral);
  if (parts === null) return undefined;
  const [, sign = '', whole = '', fraction = '', exponent = '0'] = parts;
  const digits = `${whole}${fraction}`.replace(/^0+/, '');
  if (digits === '') return '0';
  const significant = digits.replace(/0+$/, '');
  const shift = Number(exponent) - fraction.length + digits.length - significant.length;
  return `${sign}${significant}e${shift}`;
}

function parseArrayConstructor(
  body: string,
  elementType: string,
): readonly JsonValue[] | undefined {
  if (body.trim() === '') return [];
  const values: JsonValue[] = [];
  for (const element of splitConstructorElements(body)) {
    const value = parseConstructorElement(element, elementType);
    if (value === undefined) return undefined;
    values.push(value);
  }
  return values;
}

/**
 * Reads a raw Postgres column default into the default `contract infer` prints, typing a literal by the column's native type (array, int8, numeric, JSON).
 *
 * @param rawDefault - Raw default expression from information_schema.columns.column_default
 * @param nativeType - Native column type, with `[]` for a list column
 * @returns The default, or undefined if the expression cannot be read
 */
export function parseInferredDefault(
  rawDefault: string,
  nativeType?: string,
): ColumnDefault | undefined {
  const trimmed = rawDefault.trim();
  const normalizedType = nativeType?.toLowerCase();

  if (NEXTVAL_PATTERN.test(trimmed)) {
    return { kind: 'function', expression: 'autoincrement()' };
  }

  if (normalizedType?.endsWith('[]')) {
    const elementType = normalizedType.slice(0, -2);
    const arrayMatch = trimmed.match(ARRAY_LITERAL_PATTERN);
    if (
      arrayMatch?.[1] !== undefined &&
      !SEMICOLON_DELIMITED_ELEMENT_TYPE_PATTERN.test(elementType)
    ) {
      const parsed = parseArrayLiteralBody(arrayMatch[1].replace(/''/g, "'"), elementType);
      if (parsed !== undefined) {
        return { kind: 'literal', value: parsed };
      }
    }
    const constructorMatch = unwrapOuterArrayCasts(trimmed).match(ARRAY_CONSTRUCTOR_PATTERN);
    if (constructorMatch?.[1] !== undefined) {
      const parsed = parseArrayConstructor(constructorMatch[1], elementType);
      if (parsed !== undefined) {
        return { kind: 'literal', value: parsed };
      }
    }
    if (NULL_PATTERN.test(trimmed)) return { kind: 'literal', value: null };
    return { kind: 'function', expression: trimmed };
  }

  const canonicalTimestamp = canonicalizeTimestampDefault(trimmed);
  if (canonicalTimestamp) {
    return { kind: 'function', expression: canonicalTimestamp };
  }

  if (UUID_PATTERN.test(trimmed)) {
    return { kind: 'function', expression: 'gen_random_uuid()' };
  }

  if (UUID_OSSP_PATTERN.test(trimmed)) {
    return { kind: 'function', expression: 'gen_random_uuid()' };
  }

  if (NULL_PATTERN.test(trimmed)) {
    return { kind: 'literal', value: null };
  }

  if (TRUE_PATTERN.test(trimmed)) {
    return { kind: 'literal', value: true };
  }
  if (FALSE_PATTERN.test(trimmed)) {
    return { kind: 'literal', value: false };
  }

  const token = readLiteralToken(trimmed);
  if (token === undefined) {
    return { kind: 'function', expression: trimmed };
  }

  if (token.kind === 'number') {
    const value = numberValue(token.numeral, normalizedType);
    return value === undefined ? undefined : { kind: 'literal', value };
  }

  if (normalizedType !== undefined && isJsonElementType(normalizedType)) {
    const document = readJsonDocument(token.text);
    if (document.kind === 'inexact') return { kind: 'function', expression: trimmed };
    if (document.kind === 'json') return { kind: 'literal', value: document.value };
  }
  const text = storedText(token.text, normalizedType);
  return text === undefined
    ? { kind: 'function', expression: trimmed }
    : { kind: 'literal', value: text };
}
