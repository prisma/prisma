import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract } from './_fixture/optional/generated/contract';
import contractJson from './_fixture/optional/generated/contract.json' with { type: 'json' };

describe('ports/engines/queries/filters/json', () => {
  it.fails(
    'no_shorthands',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        const attempts = [
          () => db.public.TestModel.where({ json: {} }),
          () => db.public.TestModel.where({ json: null }),
        ];
        const rejected = attempts.map((attempt) => {
          try {
            attempt();
            return false;
          } catch {
            return true;
          }
        });
        expect(rejected).toEqual([true, true]);
      }),
    timeouts.spinUpPpgDev,
  );
});
