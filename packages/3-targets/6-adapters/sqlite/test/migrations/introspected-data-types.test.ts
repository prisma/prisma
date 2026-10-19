/**
 * Introspection gives each column the data type that claims the type SQLite reports, and no data type when nothing in the stack claims it.
 */
import { SqlSchemaIR } from '@internal/sql-schema-ir/types';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestDatabase, familyInstance, type TestDatabase } from './fixtures/runner-fixtures';

describe('introspected column data types', () => {
  let database: TestDatabase | undefined;

  afterEach(() => {
    database?.cleanup();
    database = undefined;
  });

  it('resolves each declared type through the stack data types', async () => {
    database = createTestDatabase();
    database.driver.db.exec(`create table t (
      id integer primary key,
      name TEXT not null,
      ratio real,
      payload blob,
      code character,
      label Character  Varying,
      sized varchar(10),
      amount numeric
    )`);

    const schema = await familyInstance.introspect({ driver: database.driver });
    if (!(schema instanceof SqlSchemaIR)) throw new Error('expected a SqlSchemaIR');
    const columns = schema.tables['t']!.columns;

    expect(
      Object.fromEntries(
        Object.entries(columns).map(([name, column]) => [
          name,
          {
            dataType: column.dataType?.id,
            storedType: column.storedType?.id,
            typeParams: column.typeParams,
          },
        ]),
      ),
    ).toEqual({
      id: { dataType: 'sqlite/integer', storedType: 'sqlite/integer', typeParams: {} },
      name: { dataType: 'sqlite/text', storedType: 'sqlite/text', typeParams: {} },
      ratio: { dataType: 'sqlite/real', storedType: 'sqlite/real', typeParams: {} },
      payload: { dataType: 'sqlite/blob', storedType: 'sqlite/blob', typeParams: {} },
      code: { dataType: 'sqlite/character', storedType: 'sqlite/character', typeParams: {} },
      label: {
        dataType: 'sqlite/character-varying',
        storedType: 'sqlite/character-varying',
        typeParams: {},
      },
      sized: { dataType: undefined, storedType: undefined, typeParams: undefined },
      amount: { dataType: undefined, storedType: undefined, typeParams: undefined },
    });
  });
});
