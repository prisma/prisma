import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract as PostgresContract } from './_fixture/postgres/generated/contract';
import postgresContractJson from './_fixture/postgres/generated/contract.json' with {
  type: 'json',
};

function withEnum(fn: Parameters<typeof withPostgresPort<PostgresContract>>[1]) {
  return withPostgresPort<PostgresContract>({ contractJson: postgresContractJson }, fn);
}

describe('ports/engines/queries/data_types/enum_type', () => {
  it(
    'read_one',
    () =>
      withEnum(async ({ db }) => {
        await db.public.TestModel.create({ id: 1, my_enum: 'A' });
        await db.public.TestModel.create({ id: 2, my_enum: 'B' });
        await db.public.TestModel.create({ id: 3 });
        const result = await db.public.TestModel.select('my_enum').first({ id: 1 });
        expect(result).toEqual({ my_enum: 'A' });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'read_many',
    () =>
      withEnum(async ({ db }) => {
        await db.public.TestModel.create({ id: 1, my_enum: 'A' });
        await db.public.TestModel.create({ id: 2, my_enum: 'B' });
        await db.public.TestModel.create({ id: 3 });
        const result = await db.public.TestModel.select('my_enum').all();
        expect(result).toEqual([{ my_enum: 'A' }, { my_enum: 'B' }, { my_enum: null }]);
      }),
    timeouts.spinUpPpgDev,
  );
});
