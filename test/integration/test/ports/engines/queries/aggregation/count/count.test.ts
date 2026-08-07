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
});
