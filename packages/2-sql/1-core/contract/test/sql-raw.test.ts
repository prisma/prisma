import { describe, expect, it } from 'vitest';
import {
  findSqlDataTypeCollision,
  namesTypeAsReported,
  renderSqlCatalogText,
  renderSqlTypeName,
  resolveReportedSqlType,
  resolveWrittenSqlTypes,
  sqlBaseName,
  unquotedSqlBaseName,
} from '../src/sql-data-type';
import { SQL_RAW_DATA_TYPE_ID, sqlRawDataType } from '../src/sql-raw';
import { enumType, int4, numeric, timestamp, vector } from './sql-data-type-fixtures';

const invalidParams = expect.objectContaining({ code: 'CONTRACT.TYPE_PARAMS_INVALID' });

describe('the sql/raw data type', () => {
  it('is sql/raw', () => {
    expect(sqlRawDataType.id).toBe(SQL_RAW_DATA_TYPE_ID);
    expect(SQL_RAW_DATA_TYPE_ID).toBe('sql/raw');
  });

  it('writes and prints its sql parameter as given', () => {
    const params = { sql: 'character varying(10)' };
    expect([
      renderSqlTypeName(sqlRawDataType, params),
      renderSqlCatalogText(sqlRawDataType, params),
      sqlBaseName(sqlRawDataType, params),
      unquotedSqlBaseName(sqlRawDataType, params),
    ]).toEqual(Array(4).fill('character varying(10)'));
  });

  it('keeps letter case, quotes and schema in the text', () => {
    expect(renderSqlTypeName(sqlRawDataType, { sql: 'extensions."LTree"' })).toBe(
      'extensions."LTree"',
    );
  });

  it('refuses a missing, empty or non-string sql parameter', () => {
    expect(() => renderSqlTypeName(sqlRawDataType, {})).toThrow(invalidParams);
    expect(() => renderSqlTypeName(sqlRawDataType, { sql: '' })).toThrow(invalidParams);
    expect(() => renderSqlTypeName(sqlRawDataType, { sql: 4 })).toThrow(invalidParams);
  });

  it('claims no reported type and reads no written text', () => {
    const types = [sqlRawDataType];
    expect([
      resolveReportedSqlType(
        { text: 'tsvector', kind: undefined, schema: 'pg_catalog', name: 'tsvector' },
        types,
      ),
      resolveReportedSqlType({ text: 'mood', kind: 'enum', schema: 'public', name: 'mood' }, types),
      resolveWrittenSqlTypes('tsvector', types),
    ]).toEqual([undefined, undefined, []]);
  });

  it('has no literal values: its canonical form refuses every value', () => {
    for (const value of ["'a':1", 1, true, { a: 1 }]) {
      expect(() => sqlRawDataType.toCanonicalForm?.(value)).toThrow(
        expect.objectContaining({ code: 'CONTRACT.CAST_REFUSED' }),
      );
    }
  });

  it('takes no value of another type through a cast', () => {
    expect([Object.keys(sqlRawDataType.casts), sqlRawDataType.listCast]).toEqual([[], undefined]);
  });

  it('collides with no other data type', () => {
    expect(
      findSqlDataTypeCollision([sqlRawDataType, int4, numeric, timestamp, vector, enumType]),
    ).toBeUndefined();
  });
});

describe('namesTypeAsReported', () => {
  it('holds for a type that renders and declares no texts and no kind', () => {
    expect(namesTypeAsReported(sqlRawDataType)).toBe(true);
  });

  it('does not hold for a type with texts or one that claims a kind', () => {
    expect([namesTypeAsReported(int4), namesTypeAsReported(enumType)]).toEqual([false, false]);
  });
});
