import { postgresRawCodecInferer } from '@internal/adapter-postgres/adapter';
import { sql } from '@internal/sql-builder/runtime';
import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

describe('ports/engines/queries/aggregation/count', () => {
  it(
    'returns zero count with no records',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        const result = await db.public.TestModel.aggregate((aggregate) => ({
          count: aggregate.count(),
        }));

        expect(result).toEqual({ count: 0n });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'counts non-null values in nullable fields',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        await db.public.TestModel.createAll([
          { id: 1, string: 'test1' },
          { id: 2, int: 1 },
        ]);

        const collection = db.public.TestModel;
        const query = sql<Contract>({
          context: collection.ctx.context,
          rawCodecInferer: postgresRawCodecInferer,
        });
        const result = await collection.ctx.runtime.execute(
          query.public.testModel
            .select('_all', (_fields, functions) => functions.count())
            .select('string', (fields, functions) => functions.count(fields.testModel.string))
            .select('int', (fields, functions) => functions.count(fields.testModel.int))
            .build(),
        );

        expect(result).toEqual([{ _all: 2n, string: 1n, int: 1n }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'preserves requested field order for empty counts',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        const collection = db.public.TestModel;
        const query = sql<Contract>({
          context: collection.ctx.context,
          rawCodecInferer: postgresRawCodecInferer,
        });
        const allStringInt = await collection.ctx.runtime.execute(
          query.public.testModel
            .select('_all', (_fields, functions) => functions.count())
            .select('string', (fields, functions) => functions.count(fields.testModel.string))
            .select('int', (fields, functions) => functions.count(fields.testModel.int))
            .build(),
        );
        const stringAllInt = await collection.ctx.runtime.execute(
          query.public.testModel
            .select('string', (fields, functions) => functions.count(fields.testModel.string))
            .select('_all', (_fields, functions) => functions.count())
            .select('int', (fields, functions) => functions.count(fields.testModel.int))
            .build(),
        );

        expect(allStringInt).toEqual([{ _all: 0n, string: 0n, int: 0n }]);
        expect(Object.keys(allStringInt[0]!)).toEqual(['_all', 'string', 'int']);
        expect(stringAllInt).toEqual([{ string: 0n, _all: 0n, int: 0n }]);
        expect(Object.keys(stringAllInt[0]!)).toEqual(['string', '_all', 'int']);
      }),
    timeouts.spinUpPpgDev,
  );
});
