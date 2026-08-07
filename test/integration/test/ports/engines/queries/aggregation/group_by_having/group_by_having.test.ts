import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract } from './_fixture/decimal/generated/contract';
import contractJson from './_fixture/decimal/generated/contract.json' with { type: 'json' };

function withDecimalGroupByHaving(fn: Parameters<typeof withPostgresPort<Contract>>[1]) {
  return withPostgresPort<Contract>({ contractJson }, fn);
}

describe('ports/engines/queries/aggregation/group_by_having', () => {
  it(
    'having_avg_scalar_filter',
    () =>
      withDecimalGroupByHaving(async ({ db }) => {
        await db.public.TestModel.createAll([
          { id: 1, decimal: '10', string: 'group1' },
          { id: 2, decimal: '6', string: 'group1' },
          { id: 3, decimal: '5', string: 'group2' },
          { id: 4, decimal: null, string: 'group2' },
          { id: 5, decimal: null, string: 'group3' },
          { id: 6, decimal: null, string: 'group3' },
        ]);

        const result = await db.public.TestModel.groupBy('string')
          .having((having) => having.avg('decimal').eq(8))
          .aggregate((aggregate) => ({ decimal: aggregate.avg('decimal') }));

        expect(result).toEqual([{ string: 'group1', decimal: '8.0000000000000000' }]);
      }),
    timeouts.spinUpPpgDev,
  );
});
