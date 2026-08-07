import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type {
  Contract as DecimalContract,
  FieldInputTypes as DecimalFieldInputTypes,
} from './_fixture/decimal/generated/contract';
import decimalContractJson from './_fixture/decimal/generated/contract.json' with { type: 'json' };
import type { Contract as NumericContract } from './_fixture/numeric/generated/contract';
import numericContractJson from './_fixture/numeric/generated/contract.json' with { type: 'json' };

type DecimalInput = DecimalFieldInputTypes['public']['TestModel']['decimal'];

describe('ports/engines/queries/aggregation/sum', () => {
  it(
    'returns null sums for numeric columns with no records',
    () =>
      withPostgresPort<NumericContract>({ contractJson: numericContractJson }, async ({ db }) => {
        const result = await db.public.TestModel.aggregate((aggregate) => ({
          int: aggregate.sum('int'),
          bInt: aggregate.sum('bInt'),
          float: aggregate.sum('float'),
        }));

        expect(result).toEqual({ int: null, bInt: null, float: null });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'sums numeric columns over records',
    () =>
      withPostgresPort<NumericContract>({ contractJson: numericContractJson }, async ({ db }) => {
        await db.public.TestModel.create({ id: 1, float: 5.5, int: 5, bInt: 5n });
        await db.public.TestModel.create({ id: 2, float: 4.5, int: 10, bInt: 10n });

        const result = await db.public.TestModel.aggregate((aggregate) => ({
          int: aggregate.sum('int'),
          bInt: aggregate.sum('bInt'),
          float: aggregate.sum('float'),
        }));

        expect(result).toEqual({ int: 15n, bInt: '15', float: 10 });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'returns a null decimal sum with no records',
    () =>
      withPostgresPort<DecimalContract>({ contractJson: decimalContractJson }, async ({ db }) => {
        const result = await db.public.TestModel.aggregate((aggregate) => ({
          decimal: aggregate.sum('decimal'),
        }));

        expect(result).toEqual({ decimal: null });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'sums decimal values over records',
    () =>
      withPostgresPort<DecimalContract>({ contractJson: decimalContractJson }, async ({ db }) => {
        await db.public.TestModel.create({ id: 1, decimal: '5.5' as DecimalInput });
        await db.public.TestModel.create({ id: 2, decimal: '4.5' as DecimalInput });

        const result = await db.public.TestModel.aggregate((aggregate) => ({
          decimal: aggregate.sum('decimal'),
        }));

        expect(result).toEqual({ decimal: '10.0' });
      }),
    timeouts.spinUpPpgDev,
  );
});
