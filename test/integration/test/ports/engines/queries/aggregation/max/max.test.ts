import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract as CommonContract } from './_fixture/common/generated/contract';
import commonContractJson from './_fixture/common/generated/contract.json' with { type: 'json' };
import type { Contract as DecimalContract } from './_fixture/decimal/generated/contract';
import decimalContractJson from './_fixture/decimal/generated/contract.json' with { type: 'json' };

function withCommonMax(fn: Parameters<typeof withPostgresPort<CommonContract>>[1]) {
  return withPostgresPort<CommonContract>({ contractJson: commonContractJson }, fn);
}

function withDecimalMax(fn: Parameters<typeof withPostgresPort<DecimalContract>>[1]) {
  return withPostgresPort<DecimalContract>({ contractJson: decimalContractJson }, fn);
}

describe('ports/engines/queries/aggregation/max', () => {
  it(
    'max_no_records',
    () =>
      withCommonMax(async ({ db }) => {
        const result = await db.public.TestModel.aggregate((aggregate) => ({
          string: aggregate.max('string'),
          int: aggregate.max('int'),
          bInt: aggregate.max('bInt'),
          float: aggregate.max('float'),
        }));

        expect(result).toEqual({ string: null, int: null, bInt: null, float: null });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'max_some_records',
    () =>
      withCommonMax(async ({ db }) => {
        await db.public.TestModel.createAll([
          { id: 1, float: 5.5, int: 5, bInt: 5n, string: 'a' },
          { id: 2, float: 4.5, int: 10, bInt: 10n, string: 'b' },
        ]);

        const result = await db.public.TestModel.aggregate((aggregate) => ({
          int: aggregate.max('int'),
          bInt: aggregate.max('bInt'),
          float: aggregate.max('float'),
          string: aggregate.max('string'),
        }));

        expect(result).toEqual({ int: 10, bInt: 10n, float: 5.5, string: 'b' });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'decimal max_no_records',
    () =>
      withDecimalMax(async ({ db }) => {
        const result = await db.public.TestModel.aggregate((aggregate) => ({
          decimal: aggregate.max('decimal'),
        }));

        expect(result).toEqual({ decimal: null });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'decimal max_some_records',
    () =>
      withDecimalMax(async ({ db }) => {
        await db.public.TestModel.createAll([
          { id: 1, decimal: '5.5' },
          { id: 2, decimal: '4.5' },
        ]);

        const result = await db.public.TestModel.aggregate((aggregate) => ({
          decimal: aggregate.max('decimal'),
        }));

        expect(result).toEqual({ decimal: '5.5' });
      }),
    timeouts.spinUpPpgDev,
  );
});
