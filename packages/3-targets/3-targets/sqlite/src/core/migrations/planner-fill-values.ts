import type { CodecControlHooks } from '@internal/family-sql/control';
import { type SqlTypeLookups, sqlDataTypeOfCodec } from '@internal/sql-contract/data-type';
import type { SqlColumnIR } from '@internal/sql-schema-ir/types';
import { SQLITE_DATETIME_CODEC_ID, SQLITE_JSON_CODEC_ID } from '../codec-ids';
import { encodeSqliteDatetime } from '../codecs';
import {
  sqliteBlob,
  sqliteCharacter,
  sqliteCharacterVarying,
  sqliteInteger,
  sqliteReal,
  sqliteText,
} from '../data-types';
import { escapeLiteral } from '../sql-utils';

/** Values for the codecs that store text their reader parses, so `''` would not read back. */
const CODEC_FILL_VALUES: ReadonlyMap<string, string> = new Map([
  [SQLITE_DATETIME_CODEC_ID, `'${escapeLiteral(encodeSqliteDatetime(new Date(0)))}'`],
  [SQLITE_JSON_CODEC_ID, `'{}'`],
]);

const DATA_TYPE_FILL_VALUES: ReadonlyMap<string, string> = new Map([
  [sqliteInteger.id, '0'],
  [sqliteReal.id, '0'],
  [sqliteText.id, "''"],
  [sqliteCharacter.id, "''"],
  [sqliteCharacterVarying.id, "''"],
  [sqliteBlob.id, "X''"],
]);

function isParamRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The SQL value a new required column takes in the rows a table already has, or `undefined` when
 * its type has none: the column's codec hook first, as on Postgres, then a value the codec reads
 * back, then a value of the data type it stores.
 */
export function sqliteFillValue(
  column: SqlColumnIR,
  codecHooks: ReadonlyMap<string, CodecControlHooks>,
  types: SqlTypeLookups,
): string | undefined {
  const codecRef = column.codecRef;
  if (codecRef === undefined || column.many === true) return undefined;
  const dataType = sqlDataTypeOfCodec(codecRef.codecId, types).id;
  const fromHook = codecHooks.get(codecRef.codecId)?.resolveIdentityValue?.({
    dataType,
    codecId: codecRef.codecId,
    ...(isParamRecord(codecRef.typeParams) ? { typeParams: codecRef.typeParams } : {}),
  });
  if (fromHook !== undefined) return fromHook ?? undefined;
  return CODEC_FILL_VALUES.get(codecRef.codecId) ?? DATA_TYPE_FILL_VALUES.get(dataType);
}
