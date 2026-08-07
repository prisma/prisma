import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract as CommonContract } from './_fixture/common/generated/contract';
import commonContractJson from './_fixture/common/generated/contract.json' with { type: 'json' };
import type { Contract as DecimalContract } from './_fixture/decimal/generated/contract';
import decimalContractJson from './_fixture/decimal/generated/contract.json' with { type: 'json' };

function withCommonMin(fn: Parameters<typeof withPostgresPort<CommonContract>>[1]) {
  return withPostgresPort<CommonContract>({ contractJson: commonContractJson }, fn);
}

function withDecimalMin(fn: Parameters<typeof withPostgresPort<DecimalContract>>[1]) {
  return withPostgresPort<DecimalContract>({ contractJson: decimalContractJson }, fn);
}

describe('ports/engines/queries/aggregation/min', () => {
  it(
    'min_no_records',
    () =>
      withCommonMin(async ({ db }) => {
        const result = await db.public.TestModel.aggregate((aggregate) => ({
          string: aggregate.min('string'),
          int: aggregate.min('int'),
          bInt: aggregate.min('bInt'),
          float: aggregate.min('float'),
        }));

        expect(result).toEqual({ string: null, int: null, bInt: null, float: null });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'min_some_records',
    () =>
      withCommonMin(async ({ db }) => {
        await db.public.TestModel.createAll([
          { id: 1, float: 5.5, int: 5, bInt: 5n, string: 'a' },
          { id: 2, float: 4.5, int: 10, bInt: 10n, string: 'b' },
        ]);

        const result = await db.public.TestModel.aggregate((aggregate) => ({
          int: aggregate.min('int'),
          bInt: aggregate.min('bInt'),
          float: aggregate.min('float'),
          string: aggregate.min('string'),
        }));

        expect(result).toEqual({ int: 5, bInt: 5n, float: 4.5, string: 'a' });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'decimal min_no_records',
    () =>
      withDecimalMin(async ({ db }) => {
        const result = await db.public.TestModel.aggregate((aggregate) => ({
          decimal: aggregate.min('decimal'),
        }));

        expect(result).toEqual({ decimal: null });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'decimal min_some_records',
    () =>
      withDecimalMin(async ({ db }) => {
        await db.public.TestModel.createAll([
          { id: 1, decimal: '5.5' },
          { id: 2, decimal: '4.5' },
        ]);

        const result = await db.public.TestModel.aggregate((aggregate) => ({
          decimal: aggregate.min('decimal'),
        }));

        expect(result).toEqual({ decimal: '4.5' });
      }),
    timeouts.spinUpPpgDev,
  );
});
