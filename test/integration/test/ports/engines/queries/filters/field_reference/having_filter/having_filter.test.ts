import { describe, expect, it } from 'vitest';
import { timeouts } from '../../../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };
import { withPostgresClient } from './with-postgres-client';

describe('ports/engines/queries/filters/field-reference/having-filter', () => {
  it(
    'basic_having_filter',
    () =>
      withPostgresClient<Contract>(contractJson, async (client) => {
        await client.orm.public.TestModel.createAll([
          { id: 1, string: 'group1', string2: 'group1', int: 1, int2: 1 },
          { id: 2, string: 'group1', string2: 'group2', int: 4, int2: 2 },
          { id: 3, string: 'group2', string2: 'group2', int: 2, int2: 2 },
          { id: 4, string: 'group3', string2: 'group2', int: 3, int2: 4 },
        ]);

        const equalGroups = await client.runtime().execute(
          client.sql.public.testModel
            .select('string', 'string2')
            .groupBy('string', 'string2')
            .having((fields, functions) => functions.eq(fields.string, fields.string2))
            .build(),
        );
        expect(equalGroups).toEqual([
          { string: 'group1', string2: 'group1' },
          { string: 'group2', string2: 'group2' },
        ]);

        const countGroups = await client.runtime().execute(
          client.sql.public.testModel
            .select('string', 'int')
            .select('count', (fields, functions) => functions.count(fields.string))
            .groupBy('string', 'int')
            .having((fields, functions) => functions.eq(functions.count(fields.string), fields.int))
            .build(),
        );
        expect(countGroups).toEqual([{ string: 'group1', int: 1, count: 1n }]);

        const maxGroups = await client.runtime().execute(
          client.sql.public.testModel
            .select('string', 'int2')
            .select('max', (fields, functions) => functions.max(fields.int))
            .groupBy('string', 'int', 'int2')
            .having((fields, functions) => functions.eq(functions.max(fields.int), fields.int2))
            .build(),
        );
        expect([
          [
            { string: 'group1', int2: 1, max: 1 },
            { string: 'group2', int2: 2, max: 2 },
          ],
          [
            { string: 'group2', int2: 2, max: 2 },
            { string: 'group1', int2: 1, max: 1 },
          ],
        ]).toContainEqual(maxGroups);
      }),
    timeouts.spinUpPpgDev,
  );
});
