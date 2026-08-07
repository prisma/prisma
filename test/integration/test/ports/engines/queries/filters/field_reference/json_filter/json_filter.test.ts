import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

describe('ports/engines/queries/filters/field-reference/json-filter', () => {
  it(
    'preserves nulls inside JSON values',
    () =>
      withPostgresPort<Contract>({ contractJson }, async ({ db }) => {
        await db.public.TestModel.create({ id: 1, json: { a: null } });

        const rows = await db.public.TestModel.select('id', 'json').all();

        expect(rows).toEqual([{ id: 1, json: { a: null } }]);
      }),
    timeouts.spinUpPpgDev,
  );
});
