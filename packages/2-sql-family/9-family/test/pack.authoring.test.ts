import { describe, expect, it } from 'vitest';
import sqlFamilyPack, {
  sqlIdentifierTypeAliases,
  sqlTargetTypeConstructors,
} from '../src/exports/pack';

describe('sql family pack authoring contributions', () => {
  it('contributes Raw, whose argument is a sql expression', () => {
    expect(sqlFamilyPack.authoring.type).toEqual({
      Raw: {
        kind: 'typeConstructor',
        documentation:
          'A column of a type no other column type covers, written exactly as the database catalog prints it, such as Raw(sql`tsvector`). Its values are typed unknown, and its default is a sql expression.',
        args: [{ kind: 'value', dataType: 'sql/expression', name: 'sql' }],
        output: { codecId: 'sql/raw@1', typeParams: { sql: { kind: 'arg', index: 0 } } },
      },
    });
  });

  it('registers sql/expression with its authoring entry, so the TypeScript builder reads sql values', () => {
    expect({
      dataTypes: sqlFamilyPack.dataTypes.map((type) => type.id),
      entries: Object.keys(sqlFamilyPack.authoring.dataTypes),
    }).toEqual({ dataTypes: ['sql/expression'], entries: ['sql/expression'] });
  });

  it('builds sql.String, sql.Char and the identifier aliases for a target, whose length is a value of the target’s size type', () => {
    expect(sqlTargetTypeConstructors({ sizeType: 'pg/int4' })).toEqual({
      sql: {
        String: {
          kind: 'typeConstructor',
          documentation: 'Variable-length text with a required maximum character length.',
          args: [{ kind: 'value', dataType: 'pg/int4', name: 'length' }],
          output: { codecId: 'sql/varchar@1', typeParams: { length: { kind: 'arg', index: 0 } } },
        },
        Char: {
          kind: 'typeConstructor',
          documentation: 'Fixed-length text with a required character length.',
          args: [{ kind: 'value', dataType: 'pg/int4', name: 'length' }],
          output: { codecId: 'sql/char@1', typeParams: { length: { kind: 'arg', index: 0 } } },
        },
        ...identifierAliases,
      },
    });
  });

  it('contributes one alias per generated identifier format, each a fixed-length character column', () => {
    expect(sqlIdentifierTypeAliases).toEqual(identifierAliases);
  });
});

function charAlias(length: number, documentation: string) {
  return {
    kind: 'typeAlias',
    documentation,
    output: { type: { codecId: 'sql/char@1', typeParams: { length } } },
  };
}

const identifierAliases = {
  UuidString: charAlias(
    36,
    'Fixed-length text of 36 characters, the column a UUID is stored in as text.',
  ),
  Ulid: charAlias(26, 'Fixed-length text of 26 characters, the column a ULID is stored in.'),
  Nanoid: charAlias(
    21,
    'Fixed-length text of 21 characters, the column a nanoid of the default size is stored in.',
  ),
  Cuid2: charAlias(24, 'Fixed-length text of 24 characters, the column a CUID2 is stored in.'),
  Ksuid: charAlias(27, 'Fixed-length text of 27 characters, the column a KSUID is stored in.'),
};
