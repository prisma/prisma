import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

function withDateTime(fn: Parameters<typeof withPostgresPort<Contract>>[1]) {
  return withPostgresPort<Contract>({ contractJson }, fn);
}

const firstDate = new Date('1900-10-10T01:10:10.001Z');
const secondDate = new Date('1969-01-01T10:33:59.000Z');

describe('ports/engines/queries/data_types/datetime', () => {
  it(
    'read_one',
    () =>
      withDateTime(async ({ db }) => {
        await db.public.TestModel.create({ id: 1, dt: firstDate });
        await db.public.TestModel.create({ id: 2, dt: secondDate });
        await db.public.TestModel.create({ id: 3 });
        const result = await db.public.TestModel.select('dt').first({ id: 1 });
        expect(result).toEqual({ dt: firstDate });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'read_many',
    () =>
      withDateTime(async ({ db }) => {
        await db.public.TestModel.create({ id: 1, dt: firstDate });
        await db.public.TestModel.create({ id: 2, dt: secondDate });
        await db.public.TestModel.create({ id: 3 });
        const result = await db.public.TestModel.select('dt').all();
        expect(result).toEqual([{ dt: firstDate }, { dt: secondDate }, { dt: null }]);
      }),
    timeouts.spinUpPpgDev,
  );
});
