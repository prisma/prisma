import { collectScalarTypeConstructors } from '@internal/framework-components/authoring';
import { createDataTypeLookup } from '@internal/framework-components/codec';
import { unquotedSqlBaseNameOfCodec } from '@internal/sql-contract/data-type';
import { describe, expect, it } from 'vitest';
import { sqliteAuthoringTypes } from '../src/core/authoring';
import { createSqliteBuiltinCodecLookup } from '../src/core/codec-registry';
import { sqliteDataTypes } from '../src/core/data-types';
import { sqliteScalarTypeConstructors } from '../src/core/type-constructors';
import sqliteTargetPack from '../src/exports/pack';

describe('the type constructors the SQLite target contributes', () => {
  it('are the base scalars and the target’s own, so PSL and type.* see the same names', () => {
    expect(sqliteTargetPack.authoring.type).toEqual({
      ...sqliteScalarTypeConstructors,
      ...sqliteAuthoringTypes,
    });
    expect(Object.keys(sqliteAuthoringTypes)).toEqual(['sql', 'BigIntNumber', 'temporal']);
  });

  it('contributes the family’s sql.String, whose length is a value of sqlite/real', () => {
    expect(sqliteAuthoringTypes.sql.String.args).toEqual([
      { kind: 'value', dataType: 'sqlite/real', name: 'length' },
    ]);
  });

  it('contribute the temporal type aliases on DateTime', () => {
    const now = { name: 'now', args: {} };
    const { CreatedAt, UpdatedAt } = sqliteAuthoringTypes.temporal;
    expect([CreatedAt.output, UpdatedAt.output]).toEqual([
      { type: { codecId: 'sqlite/datetime@1' }, onCreate: now },
      { type: { codecId: 'sqlite/datetime@1' }, onCreate: now, onUpdate: now },
    ]);
  });

  it('document what each temporal type alias sets and the value it gives', () => {
    const { CreatedAt, UpdatedAt } = sqliteAuthoringTypes.temporal;
    expect([CreatedAt.documentation, UpdatedAt.documentation]).toEqual([
      'A timestamp the client sets to now when a row is created. Its value is a JavaScript Date.',
      'A timestamp the client sets to now when a row is created and every time it is updated. Its value is a JavaScript Date.',
    ]);
  });

  const allConstructors = {
    ...sqliteAuthoringTypes.sql,
    BigIntNumber: sqliteAuthoringTypes.BigIntNumber,
    ...sqliteScalarTypeConstructors,
  };

  const scalarNames = [
    ['String', 'sqlite/text@1', 'text'],
    ['Int', 'sqlite/integer@1', 'integer'],
    ['BigInt', 'sqlite/bigint@1', 'integer'],
    ['Float', 'sqlite/real@1', 'real'],
    ['Decimal', 'sqlite/text@1', 'text'],
    ['DateTime', 'sqlite/datetime@1', 'text'],
    ['Json', 'sqlite/json@1', 'text'],
    ['Bytes', 'sqlite/blob@1', 'blob'],
  ] as const;

  it('pins every base scalar to its codec', () => {
    expect(Object.fromEntries(collectScalarTypeConstructors(sqliteScalarTypeConstructors))).toEqual(
      Object.fromEntries(scalarNames.map(([name, codecId]) => [name, { codecId }])),
    );
  });

  it.each(scalarNames)(
    '%s keeps its type name, now its codec’s data type’s',
    (_name, codecId, typeName) => {
      expect(
        unquotedSqlBaseNameOfCodec(codecId, undefined, {
          codecLookup: createSqliteBuiltinCodecLookup(),
          dataTypeLookup: createDataTypeLookup(sqliteDataTypes),
        }),
      ).toBe(typeName);
    },
  );

  it('marks no constructor inferred, because SQLite has no contract infer', () => {
    expect(Object.values(allConstructors).filter((descriptor) => 'inferred' in descriptor)).toEqual(
      [],
    );
  });

  it.each([...Object.entries(allConstructors), ...Object.entries(sqliteAuthoringTypes.temporal)])(
    'documents %s',
    (_name, descriptor) => {
      expect(descriptor).toHaveProperty('documentation', expect.stringMatching(/\S.+/));
    },
  );
});
