import { InternalError } from '@internal/utils/internal-error';
import { describe, expect, it } from 'vitest';
import {
  findSqlDataTypeCollision,
  nameIsCatalogText,
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

  it('writes, prints and names its type as its sql parameter, as given', () => {
    const params = { sql: 'character varying(10)' };
    expect([
      renderSqlTypeName(sqlRawDataType, params),
      renderSqlCatalogText(sqlRawDataType, params),
      unquotedSqlBaseName(sqlRawDataType, params),
    ]).toEqual(Array(3).fill('character varying(10)'));
  });

  it('has no base name, since its parameters cannot be separated from its name', () => {
    expect(() => sqlBaseName(sqlRawDataType, { sql: 'character varying(10)' })).toThrow(
      InternalError,
    );
  });

  it('keeps letter case, quotes and schema in the text', () => {
    expect(renderSqlTypeName(sqlRawDataType, { sql: 'extensions."LTree"' })).toBe(
      'extensions."LTree"',
    );
  });

  it('refuses a missing or non-string sql parameter', () => {
    expect(() => renderSqlTypeName(sqlRawDataType, {})).toThrow(invalidParams);
    expect(() => renderSqlTypeName(sqlRawDataType, { sql: 4 })).toThrow(invalidParams);
  });

  it.each([
    'tsvector',
    'character varying(10)',
    'geometry(Point,4326)',
    'numeric(10, 2)',
    'timestamp(3) with time zone',
    'extensions.ltree',
    'extensions."LTree"',
    'integer[]',
  ])('takes the type text %s', (sql) => {
    expect(renderSqlTypeName(sqlRawDataType, { sql })).toBe(sql);
  });

  it.each([
    ['blank', ''],
    ['only spaces', '   '],
    ['a leading space', ' tsvector'],
    ['a trailing space', 'tsvector '],
    ['a semicolon', 'text; drop table "User"'],
    ['a line comment', 'text -- x'],
    ['a block comment', 'text /* x */'],
    ['dollar quoting', 'text default $$x$$'],
    ['a comma outside parentheses', 'text, "y" int4'],
    ['an unclosed parenthesis', 'numeric(10'],
    ['a parenthesis closed before it opens', 'numeric)10('],
  ])('refuses a type text with %s, saying what a raw type is', (_name, sql) => {
    expect(() => renderSqlTypeName(sqlRawDataType, { sql })).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.TYPE_PARAMS_INVALID',
        message: expect.stringContaining(
          'A raw type is one type name as the database catalog prints it, such as tsvector or geometry(Point,4326): it must not be blank, start or end with whitespace, or contain semicolons, SQL comment tokens, dollar quoting, a comma outside parentheses or unbalanced parentheses.',
        ),
      }),
    );
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

  it('has no literal values: its canonical form refuses every value, saying to write sql', () => {
    for (const value of ["'a':1", 1, true, { a: 1 }]) {
      expect(() => sqlRawDataType.toCanonicalForm?.(value)).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.LITERAL_VALUES_ABSENT',
          message:
            'A raw column has no literal values, so its default cannot be a literal. Write the default as a SQL expression: sql`...`.',
        }),
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

describe('nameIsCatalogText', () => {
  it('holds for a type that declares it', () => {
    expect(nameIsCatalogText(sqlRawDataType)).toBe(true);
  });

  it('does not hold for a type with texts or one that claims a kind', () => {
    expect([nameIsCatalogText(int4), nameIsCatalogText(enumType)]).toEqual([false, false]);
  });
});
