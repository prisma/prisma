/**
 * Type-tests over the emitted integer-representation fixtures: a
 * `BigIntNumber` column reads as `number` and an `UnboundedInt` column as
 * `bigint` through the ORM result surface, and aggregate result types resolve
 * per the contracts' emitted `aggregateTypes` rows — including the `min`/`max`
 * self rows, whose resolved output is the input codec itself.
 */

import type { Collection } from '@internal/sql-orm-client';
import { describe, expectTypeOf, test } from 'vitest';
import type {
  Contract as PgContract,
  FieldOutputTypes as PgFieldOutputTypes,
} from './fixtures/integer-representation/generated/contract';
import type {
  Contract as SqliteContract,
  FieldOutputTypes as SqliteFieldOutputTypes,
} from './fixtures/integer-representation-sqlite/generated/contract';

declare const meters: Collection<PgContract, 'Meter'>;
declare const sqliteMeters: Collection<SqliteContract, 'Meter'>;

describe('column output types', () => {
  test('BigIntNumber reads as number and UnboundedInt as bigint on PostgreSQL', () => {
    const rows = meters.select('id', 'peak', 'lifetime').all();
    type Row = Awaited<typeof rows>[number];
    expectTypeOf<Row['peak']>().toEqualTypeOf<number>();
    expectTypeOf<Row['lifetime']>().toEqualTypeOf<bigint>();
  });

  test('the contract field-output map carries the same pair', () => {
    expectTypeOf<PgFieldOutputTypes['public']['Meter']['peak']>().toEqualTypeOf<number>();
    expectTypeOf<PgFieldOutputTypes['public']['Meter']['lifetime']>().toEqualTypeOf<bigint>();
    expectTypeOf<PgFieldOutputTypes['public']['Sample']['reading']>().toEqualTypeOf<number>();
  });

  test('BigIntNumber reads as number on SQLite', () => {
    const rows = sqliteMeters.select('id', 'peak').all();
    type Row = Awaited<typeof rows>[number];
    expectTypeOf<Row['peak']>().toEqualTypeOf<number>();
    expectTypeOf<SqliteFieldOutputTypes['__unbound__']['Meter']['peak']>().toEqualTypeOf<number>();
  });

  test('an included BigIntNumber column reads as number', () => {
    const rows = meters
      .select('id')
      .include('samples', (sample) => sample.select('id', 'reading'))
      .all();
    type Row = Awaited<typeof rows>[number];
    expectTypeOf<Row['samples'][number]['reading']>().toEqualTypeOf<number>();
  });
});

describe('aggregate result types resolve per the emitted rows', () => {
  test('PostgreSQL: sum/avg widen BigIntNumber to numeric text; UnboundedInt sums to itself', () => {
    const stats = meters.aggregate((agg) => ({
      peakSum: agg.sum('peak'),
      peakAvg: agg.avg('peak'),
      lifetimeSum: agg.sum('lifetime'),
      lifetimeAvg: agg.avg('lifetime'),
    }));
    expectTypeOf(stats).resolves.toEqualTypeOf<{
      peakSum: string | null;
      peakAvg: string | null;
      lifetimeSum: bigint | null;
      lifetimeAvg: string | null;
    }>();
  });

  test('PostgreSQL: the min/max self rows resolve to the input codec output itself', () => {
    const stats = meters.aggregate((agg) => ({
      peakMax: agg.max('peak'),
      peakMin: agg.min('peak'),
      lifetimeMax: agg.max('lifetime'),
      lifetimeMin: agg.min('lifetime'),
    }));
    expectTypeOf(stats).resolves.toEqualTypeOf<{
      peakMax: number | null;
      peakMin: number | null;
      lifetimeMax: bigint | null;
      lifetimeMin: bigint | null;
    }>();
  });

  test('SQLite: sum widens BigIntNumber to bigint, avg to real, min/max stay number', () => {
    const stats = sqliteMeters.aggregate((agg) => ({
      peakSum: agg.sum('peak'),
      peakAvg: agg.avg('peak'),
      peakMax: agg.max('peak'),
      peakMin: agg.min('peak'),
    }));
    expectTypeOf(stats).resolves.toEqualTypeOf<{
      peakSum: bigint | null;
      peakAvg: number | null;
      peakMax: number | null;
      peakMin: number | null;
    }>();
  });

  test('an include reducer over a BigIntNumber column reads the declared widened result', () => {
    const rows = meters
      .select('id')
      .include('samples', (sample) => sample.sum('reading'))
      .all();
    type Row = Awaited<typeof rows>[number];
    expectTypeOf<Row['samples']>().toEqualTypeOf<string | null>();
  });
});
