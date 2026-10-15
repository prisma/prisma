import { describe, expect, it } from 'vitest';
import { SqlColumnIR, type SqlColumnIRInput } from '../src/ir/sql-column-ir';

function expectedColumn(type: string, overrides: Partial<SqlColumnIRInput> = {}): SqlColumnIR {
  return new SqlColumnIR({
    name: 'c',
    nativeType: type,
    nullable: false,
    resolvedNativeType: type,
    comparesReportedType: true,
    ...overrides,
  });
}

function introspectedColumn(
  reported: string,
  normalized: string,
  overrides: Partial<SqlColumnIRInput> = {},
): SqlColumnIR {
  return new SqlColumnIR({
    name: 'c',
    nativeType: normalized,
    nullable: false,
    resolvedNativeType: normalized,
    reportedType: { text: reported, kind: undefined, schema: 'pg_catalog', name: reported },
    ...overrides,
  });
}

describe('a column whose type compares with the reported type', () => {
  const integerColumn = introspectedColumn('integer', 'int4');

  it('matches the text the database reports', () => {
    expect(expectedColumn('integer').isEqualTo(integerColumn)).toBe(true);
    expect(expectedColumn('integer').typeDiffersFrom(integerColumn)).toBe(false);
  });

  it('does not match another name for the type', () => {
    expect(expectedColumn('int4').isEqualTo(integerColumn)).toBe(false);
    expect(expectedColumn('int4').typeDiffersFrom(integerColumn)).toBe(true);
  });

  it('compares a list column by its element type and the list flag', () => {
    const tsvectors = introspectedColumn('tsvector', 'tsvector', {
      many: true,
      resolvedNativeType: 'tsvector[]',
    });
    expect([
      expectedColumn('tsvector', { many: true, resolvedNativeType: 'tsvector[]' }).isEqualTo(
        tsvectors,
      ),
      expectedColumn('tsvector').isEqualTo(tsvectors),
    ]).toEqual([true, false]);
  });

  it('compares the resolved types when the other side reports no type', () => {
    expect([
      expectedColumn('integer').isEqualTo(expectedColumn('integer')),
      expectedColumn('integer').isEqualTo(expectedColumn('int4')),
    ]).toEqual([true, false]);
  });

  it('still compares nullability', () => {
    expect(
      expectedColumn('integer').isEqualTo(
        introspectedColumn('integer', 'int4', { nullable: true }),
      ),
    ).toBe(false);
  });

  it('explains a type mismatch with the text the database reports', () => {
    expect(expectedColumn('int4').explainMismatch(integerColumn)).toBe(
      'The column type is "int4", but the database reports "integer". This type is compared with the text the database reports, exactly.',
    );
  });

  it('explains nothing when only the nullability differs', () => {
    expect(
      expectedColumn('integer').explainMismatch(
        introspectedColumn('integer', 'int4', { nullable: true }),
      ),
    ).toBeUndefined();
  });

  it('keeps the flag outside JSON', () => {
    const plain = new SqlColumnIR({
      name: 'c',
      nativeType: 'integer',
      nullable: false,
      resolvedNativeType: 'integer',
    });
    expect(JSON.stringify(expectedColumn('integer'))).toBe(JSON.stringify(plain));
  });
});

describe('a column whose type compares through the resolved type', () => {
  it('matches the normalized type and ignores the reported text', () => {
    const expected = new SqlColumnIR({
      name: 'c',
      nativeType: 'int4',
      nullable: false,
      resolvedNativeType: 'int4',
    });
    const actual = introspectedColumn('integer', 'int4');
    expect([
      expected.isEqualTo(actual),
      expected.typeDiffersFrom(actual),
      expected.explainMismatch(actual),
    ]).toEqual([true, false, undefined]);
  });
});
