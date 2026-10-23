import {
  PG_BOOL_CODEC_ID,
  PG_CHAR_CODEC_ID,
  PG_DATE_STRING_CODEC_ID,
  PG_DATE_TEMPORAL_CODEC_ID,
  PG_FLOAT_CODEC_ID,
  PG_FLOAT4_CODEC_ID,
  PG_FLOAT8_CODEC_ID,
  PG_INT_CODEC_ID,
  PG_INT2_CODEC_ID,
  PG_INT4_CODEC_ID,
  PG_INT8_NUMBER_CODEC_ID,
  PG_JSON_CODEC_ID,
  PG_JSONB_CODEC_ID,
  PG_NUMERIC_CODEC_ID,
  PG_TEXT_CODEC_ID,
  PG_TIME_STRING_CODEC_ID,
  PG_TIME_TEMPORAL_CODEC_ID,
  PG_TIMESTAMP_STRING_CODEC_ID,
  PG_TIMESTAMP_TEMPORAL_CODEC_ID,
  PG_TIMESTAMPTZ_DATE_CODEC_ID,
  PG_TIMESTAMPTZ_STRING_CODEC_ID,
  PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID,
  PG_UUID_CODEC_ID,
  PG_VARCHAR_CODEC_ID,
  SQL_CHAR_CODEC_ID,
  SQL_FLOAT_CODEC_ID,
  SQL_INT_CODEC_ID,
  SQL_TEXT_CODEC_ID,
  SQL_VARCHAR_CODEC_ID,
} from './codec-ids';

type JsonType = 'string' | 'number' | 'boolean';

/**
 * The JSON type a value object member of each codec has in the JSON the SQL ORM writes: the type its JavaScript value serializes to, or for `Decimal` the string the ORM writes. JSON members hold any value, and a member of a codec missing here is checked only for being present and, when required, not JSON null.
 */
const JSON_TYPE_OF_CODEC: Readonly<Record<string, JsonType>> = {
  [PG_TEXT_CODEC_ID]: 'string',
  [PG_CHAR_CODEC_ID]: 'string',
  [PG_VARCHAR_CODEC_ID]: 'string',
  [SQL_TEXT_CODEC_ID]: 'string',
  [SQL_CHAR_CODEC_ID]: 'string',
  [SQL_VARCHAR_CODEC_ID]: 'string',
  [PG_UUID_CODEC_ID]: 'string',
  [PG_NUMERIC_CODEC_ID]: 'string',
  [PG_DATE_TEMPORAL_CODEC_ID]: 'string',
  [PG_TIMESTAMP_TEMPORAL_CODEC_ID]: 'string',
  [PG_TIMESTAMPTZ_TEMPORAL_CODEC_ID]: 'string',
  [PG_TIME_TEMPORAL_CODEC_ID]: 'string',
  [PG_DATE_STRING_CODEC_ID]: 'string',
  [PG_TIMESTAMP_STRING_CODEC_ID]: 'string',
  [PG_TIMESTAMPTZ_STRING_CODEC_ID]: 'string',
  [PG_TIMESTAMPTZ_DATE_CODEC_ID]: 'string',
  [PG_TIME_STRING_CODEC_ID]: 'string',
  [PG_INT_CODEC_ID]: 'number',
  [PG_INT2_CODEC_ID]: 'number',
  [PG_INT4_CODEC_ID]: 'number',
  [PG_INT8_NUMBER_CODEC_ID]: 'number',
  [PG_FLOAT_CODEC_ID]: 'number',
  [PG_FLOAT4_CODEC_ID]: 'number',
  [PG_FLOAT8_CODEC_ID]: 'number',
  [SQL_INT_CODEC_ID]: 'number',
  [SQL_FLOAT_CODEC_ID]: 'number',
  [PG_BOOL_CODEC_ID]: 'boolean',
};

export function valueObjectJsonTypeOfCodec(codecId: string): JsonType | undefined {
  return Object.hasOwn(JSON_TYPE_OF_CODEC, codecId) ? JSON_TYPE_OF_CODEC[codecId] : undefined;
}

const JSON_CODECS: ReadonlySet<string> = new Set([PG_JSON_CODEC_ID, PG_JSONB_CODEC_ID]);

export function valueObjectMemberHoldsAnyJson(codecId: string): boolean {
  return JSON_CODECS.has(codecId);
}
