import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract } from './_fixture/main/generated/contract';
import contractJson from './_fixture/main/generated/contract.json' with { type: 'json' };

describe('ports/engines/queries/aggregation/group_by', () => {
  it(
    'returns no groups with no records',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        const result = await db.public.A.groupBy('id', 'float', 'int').aggregate((aggregate) => ({
          count: aggregate.count(),
          sum: aggregate.sum('int'),
        }));

        expect(result).toEqual([]);
      }),
    timeouts.spinUpPpgDev,
  );
});
