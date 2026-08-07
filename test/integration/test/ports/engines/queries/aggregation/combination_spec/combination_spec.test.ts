import type { Numeric } from '@internal/target-postgres/codec-types';
import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract as DecimalContract } from './_fixture/decimal/generated/contract';
import decimalContractJson from './_fixture/decimal/generated/contract.json' with { type: 'json' };
import type { Contract as NumericContract } from './_fixture/numeric/generated/contract';
import numericContractJson from './_fixture/numeric/generated/contract.json' with { type: 'json' };

describe('ports/engines/queries/aggregation/combination_spec', () => {
  it(
    'returns zero count and null numeric aggregates with no records',
    () =>
      withPostgresPort<NumericContract>({ contractJson: numericContractJson }, async ({ db }) => {
        const result = await db.public.Item.aggregate((aggregate) => ({
          count: aggregate.count(),
          sumFloat: aggregate.sum('float'),
          sumInt: aggregate.sum('int'),
          avgFloat: aggregate.avg('float'),
          avgInt: aggregate.avg('int'),
          minFloat: aggregate.min('float'),
          minInt: aggregate.min('int'),
          maxFloat: aggregate.max('float'),
          maxInt: aggregate.max('int'),
        }));

        expect(result).toEqual({
          count: 0n,
          sumFloat: null,
          sumInt: null,
          avgFloat: null,
          avgInt: null,
          minFloat: null,
          minInt: null,
          maxFloat: null,
          maxInt: null,
        });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'computes combined numeric aggregates over two rows',
    () =>
      withPostgresPort<NumericContract>({ contractJson: numericContractJson }, async ({ db }) => {
        await db.public.Item.createAll([
          { id: '1', float: 5.5, int: 5 },
          { id: '2', float: 4.5, int: 10 },
        ]);

        const result = await db.public.Item.aggregate((aggregate) => ({
          count: aggregate.count(),
          sumFloat: aggregate.sum('float'),
          sumInt: aggregate.sum('int'),
          avgFloat: aggregate.avg('float'),
          avgInt: aggregate.avg('int'),
          minFloat: aggregate.min('float'),
          minInt: aggregate.min('int'),
          maxFloat: aggregate.max('float'),
          maxInt: aggregate.max('int'),
        }));

        expect(result).toEqual({
          count: 2n,
          sumFloat: 10,
          sumInt: 15n,
          avgFloat: 5,
          avgInt: '7.5000000000000000',
          minFloat: 4.5,
          minInt: 5,
          maxFloat: 5.5,
          maxInt: 10,
        });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'returns zero count and null decimal aggregates with no records',
    () =>
      withPostgresPort<DecimalContract>({ contractJson: decimalContractJson }, async ({ db }) => {
        const result = await db.public.Item.aggregate((aggregate) => ({
          count: aggregate.count(),
          sum: aggregate.sum('dec'),
          avg: aggregate.avg('dec'),
          min: aggregate.min('dec'),
          max: aggregate.max('dec'),
        }));

        expect(result).toEqual({ count: 0n, sum: null, avg: null, min: null, max: null });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'computes combined decimal aggregates over two rows',
    () =>
      withPostgresPort<DecimalContract>({ contractJson: decimalContractJson }, async ({ db }) => {
        await db.public.Item.createAll([
          { id: '1', dec: '5.5' as Numeric<65, 30> },
          { id: '2', dec: '4.5' as Numeric<65, 30> },
        ]);

        const result = await db.public.Item.aggregate((aggregate) => ({
          count: aggregate.count(),
          sum: aggregate.sum('dec'),
          avg: aggregate.avg('dec'),
          min: aggregate.min('dec'),
          max: aggregate.max('dec'),
        }));

        expect(result).toEqual({
          count: 2n,
          sum: '10.0',
          avg: '5.0000000000000000',
          min: '4.5',
          max: '5.5',
        });
      }),
    timeouts.spinUpPpgDev,
  );
});
