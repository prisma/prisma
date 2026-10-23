/**
 * The data types this target owns: the MySQL integer, character and date-time types, and a native
 * `enum('A','B')` column type whose name is the text MySQL's catalog prints for it.
 *
 * ADR 254.
 */

import type { JsonValue } from '@internal/contract/types';
import {
  type Cast,
  type DataType,
  type DataTypeId,
  type DataTypeParams,
  type DataTypeReader,
  type DataTypeSpelling,
  dateTimeStoredText,
  INT32_RANGE,
  INT64_RANGE,
  numeralText,
  readJsonInteger,
  readJsonIntegerText,
  readJsonString,
  refuseJsonValue,
} from '@internal/framework-components/codec';
import { sqlDataType, sqlRawDataType } from '@internal/sql-contract/data-type';
import { structuredError } from '@internal/utils/structured-error';
import { type as arktype } from 'arktype';
import { mysqlError } from './errors';
import { quoteLiteral } from './sql-utils';

const unchanged: Cast = (value) => value;

function wrongShape(value: JsonValue, expected: string): never {
  throw structuredError(
    'CONTRACT.CAST_REFUSED',
    `Expected ${expected}, got ${JSON.stringify(value)}.`,
    {
      why: 'A cast reads the stored form of the type it takes values of.',
      fix: 'Hand the cast a value in the shape its source type stores.',
    },
  );
}

const asNumeralText: Cast = (value) =>
  typeof value === 'number' ? numeralText(value) : wrongShape(value, 'a number');

function integerParam(params: DataTypeParams, name: string): number | undefined {
  const value = params[name];
  return typeof value === 'number' ? value : undefined;
}

/** Text of at most `length` characters, counted as code points, as MySQL counts characters. */
function readTextOfLength(owner: string, json: JsonValue, length: number | undefined): JsonValue {
  const text = readJsonString(owner, json);
  if (length !== undefined && [...text].length > length) {
    return refuseJsonValue(
      owner,
      `a string of at most ${length} ${length === 1 ? 'character' : 'characters'}`,
      json,
    );
  }
  return json;
}

export const mysqlText = sqlDataType('mysql/text', {
  texts: [{ text: 'text', written: true, catalog: true }],
  read: (json) => readJsonString('mysql/text', json),
  casts: {},
});

const fromText: Readonly<Record<string, Cast>> = { [mysqlText.id]: unchanged };

/** A signed 32-bit integer, stored as a JSON number. */
export const mysqlInt = sqlDataType('mysql/int', {
  texts: [{ text: 'int', written: true, catalog: true }, { text: 'integer' }],
  read: (json) => readJsonInteger('mysql/int', json, INT32_RANGE),
  casts: {},
});

/** A signed 64-bit integer, stored as digit text so that no digit is lost. */
export const mysqlBigint = sqlDataType('mysql/bigint', {
  texts: [{ text: 'bigint', written: true, catalog: true }],
  read: (json) => {
    readJsonIntegerText('mysql/bigint', json, INT64_RANGE);
    return json;
  },
  casts: { [mysqlInt.id]: asNumeralText },
});

/** The length of `varchar`, which MySQL requires, up to the largest it accepts. */
export const mysqlVarcharParams = arktype({
  length: 'number.integer >= 1 & number.integer <= 65535',
});

export const mysqlVarchar = sqlDataType('mysql/varchar', {
  params: mysqlVarcharParams,
  texts: [{ text: 'varchar({length})', written: true, catalog: true }],
  read: (json, params) => readTextOfLength('mysql/varchar', json, integerParam(params, 'length')),
  casts: fromText,
});

/** The length of `char`, at most 255; a bare `char` is `char(1)`. */
export const mysqlCharParams = arktype({
  'length?': 'number.integer >= 1 & number.integer <= 255',
});

export const mysqlChar = sqlDataType('mysql/char', {
  params: mysqlCharParams,
  texts: [
    { text: 'char', written: true },
    { text: 'char({length})', written: true, catalog: true },
  ],
  read: (json, params) => readTextOfLength('mysql/char', json, integerParam(params, 'length') ?? 1),
  normalize: (params) => (params.length === undefined ? { ...params, length: 1 } : params),
  casts: fromText,
});

/** The fractional-second precision of `datetime`, 0 to 6; MySQL prints a precision of 0 as a bare `datetime`. */
export const mysqlDatetimeParams = arktype({
  'precision?': 'number.integer >= 0 & number.integer <= 6',
});

const DATETIME_RANGE = {
  earliest: '1000-01-01T00:00:00',
  latest: '9999-12-31T23:59:59.999999',
} as const;

/**
 * The value of `mysql/datetime`: a date and time without a time zone, ISO 8601 text with a `T` and no trailing zeros in the fraction, within MySQL's range. Throws `CONTRACT.CAST_REFUSED` for text that names no such date and time.
 */
export function mysqlDatetimeText(text: string): string {
  return dateTimeStoredText(text, {
    shape: 'dateTime',
    ownerId: 'mysql/datetime',
    range: DATETIME_RANGE,
  });
}

function storedDatetime(text: string): string | undefined {
  try {
    return mysqlDatetimeText(text);
  } catch {
    return undefined;
  }
}

const readDatetime: DataTypeReader = (json) =>
  typeof json === 'string' && storedDatetime(json) !== undefined
    ? json
    : refuseJsonValue(
        'mysql/datetime',
        'ISO 8601 date and time text without a UTC offset, as in "2024-01-01T00:00:00"',
        json,
      );

const spellDatetime: DataTypeSpelling = (json) =>
  typeof json === 'string' ? (storedDatetime(json) ?? json) : json;

export const mysqlDatetime = sqlDataType('mysql/datetime', {
  params: mysqlDatetimeParams,
  texts: [
    { text: 'datetime', written: true, catalog: true },
    { text: 'datetime({precision})', written: true, catalog: true },
  ],
  read: readDatetime,
  spell: spellDatetime,
  normalize: ({ precision, ...rest }) => (precision === 0 ? rest : { ...rest, precision }),
  casts: {},
});

/** The members of a native enum column, in the order they are declared. */
export const mysqlEnumParams = arktype({
  'values?': 'string[]',
});

/** `enum('A','B')`, the text MySQL's catalog prints for the column type, with each member a quoted literal. */
export function renderMysqlEnumType(values: readonly string[] | undefined): string {
  if (values === undefined || values.length === 0) {
    throw mysqlError(
      'CONTRACT.TYPE_PARAMS_INVALID',
      'A MySQL enum column type needs at least one member.',
      {
        why: 'A native enum column is written with its members, and this column has none.',
        fix: 'Type the column with a PSL enum or an enumType() that declares its members.',
        meta: { dataType: 'mysql/enum' },
      },
    );
  }
  return `enum(${values.map(quoteLiteral).join(',')})`;
}

const readEnumMember: DataTypeReader = (json, params) => {
  const member = readJsonString('mysql/enum', json);
  const values = params['values'];
  if (Array.isArray(values) && !values.includes(member)) {
    return refuseJsonValue('mysql/enum', `one of the members ${values.join(', ')}`, json);
  }
  return json;
};

/**
 * A native MySQL enum. Its name is the catalog text `enum('A','B')`, so `db verify` compares the members and their order with what MySQL reports (ADR 273). A column's members are its value set's, written into its parameters by the target's namespace (see `mysql-database.ts`).
 */
export const mysqlEnum = sqlDataType('mysql/enum', {
  params: mysqlEnumParams,
  nameIsCatalogText: true,
  render: ({ values }) => renderMysqlEnumType(values),
  read: readEnumMember,
  casts: fromText,
});

/** Every data type this target registers. */
export const mysqlDataTypes: readonly DataType[] = [
  mysqlText,
  mysqlInt,
  mysqlBigint,
  mysqlVarchar,
  mysqlChar,
  mysqlDatetime,
  mysqlEnum,
  sqlRawDataType,
];

/** MySQL's text data types, which a SQL discriminator column may have. */
export const mysqlTextDataTypes: readonly DataTypeId[] = [
  mysqlText.id,
  mysqlVarchar.id,
  mysqlChar.id,
];
