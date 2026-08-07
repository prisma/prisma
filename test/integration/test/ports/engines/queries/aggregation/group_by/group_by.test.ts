import { postgresRawCodecInferer } from '@internal/adapter-postgres/adapter';
import { sql } from '@internal/sql-builder/runtime';
import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract as MainContract } from './_fixture/main/generated/contract';
import mainContractJson from './_fixture/main/generated/contract.json' with { type: 'json' };
import type { Contract as Regression21789Contract } from './_fixture/regression-21789/generated/contract';
import regression21789ContractJson from './_fixture/regression-21789/generated/contract.json' with {
  type: 'json',
};

type MainDb = import('../../../../_harness/postgres').PortContext<MainContract>['db'];

function withMainGroupBy(fn: Parameters<typeof withPostgresPort<MainContract>>[1]) {
  return withPostgresPort<MainContract>({ contractJson: mainContractJson }, fn);
}

function mainSql(db: MainDb) {
  return sql<MainContract>({
    context: db.public.A.ctx.context,
    rawCodecInferer: postgresRawCodecInferer,
  });
}

async function seedBasicRows(db: MainDb) {
  await db.public.A.createAll([
    { id: 1, float: 10.1, int: 5, string: 'group1' },
    { id: 2, float: 5.5, int: 0, string: 'group1' },
    { id: 3, float: 10, int: 5, string: 'group2' },
    { id: 4, float: 10, int: 5, string: 'group3' },
  ]);
}

async function seedOrderingRows(db: MainDb) {
  await db.public.A.createAll([
    { id: 1, float: 1.1, int: 1, string: 'group1' },
    { id: 2, float: 1.1, int: 2, string: 'group1' },
    { id: 3, float: 1.1, int: 3, string: 'group2' },
    { id: 4, float: 4, int: 3, string: 'group3' },
  ]);
}

describe('ports/engines/queries/aggregation/group_by', () => {
  it(
    'returns no groups with no records',
    () =>
      withMainGroupBy(async ({ db }) => {
        const query = mainSql(db);
        const result = await db.public.A.ctx.runtime.execute(
          query.public.a
            .select('count', (fields, functions) => functions.count(fields.a.id))
            .select('float')
            .select('sum', (fields, functions) => functions.sum(fields.a.int))
            .groupBy('id', 'float', 'int')
            .build(),
        );

        expect(result).toEqual([]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'groups records with field count and sum',
    () =>
      withMainGroupBy(async ({ db }) => {
        await seedBasicRows(db);
        const query = mainSql(db);
        const result = await db.public.A.ctx.runtime.execute(
          query.public.a
            .select('string')
            .select('count', (fields, functions) => functions.count(fields.a.string))
            .select('sum', (fields, functions) => functions.sum(fields.a.float))
            .groupBy('string')
            .orderBy('string')
            .build(),
        );

        expect(result).toEqual([
          { string: 'group1', count: 2n, sum: 15.6 },
          { string: 'group2', count: 1n, sum: 10 },
          { string: 'group3', count: 1n, sum: 10 },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'orders grouped records in reverse',
    () =>
      withMainGroupBy(async ({ db }) => {
        await seedBasicRows(db);
        const query = mainSql(db);
        const result = await db.public.A.ctx.runtime.execute(
          query.public.a
            .select('string')
            .select('count', (fields, functions) => functions.count(fields.a.string))
            .select('sum', (fields, functions) => functions.sum(fields.a.float))
            .groupBy('string')
            .orderBy('string', { direction: 'desc' })
            .build(),
        );

        expect(result).toEqual([
          { string: 'group3', count: 1n, sum: 10 },
          { string: 'group2', count: 1n, sum: 10 },
          { string: 'group1', count: 2n, sum: 15.6 },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'orders groups by multiple fields',
    () =>
      withMainGroupBy(async ({ db }) => {
        await db.public.A.createAll([
          { id: 1, float: 10.1, int: 5, string: 'group1' },
          { id: 2, float: 5.5, int: 0, string: 'group1' },
          { id: 3, float: 10, int: 5, string: 'group2' },
          { id: 4, float: 10, int: 5, string: 'group3' },
          { id: 5, float: 15, int: 5, string: 'group3' },
        ]);
        const query = mainSql(db);
        const result = await db.public.A.ctx.runtime.execute(
          query.public.a
            .select('string')
            .select('count', (fields, functions) => functions.count(fields.a.string))
            .select('sum', (fields, functions) => functions.sum(fields.a.float))
            .select('min', (fields, functions) => functions.min(fields.a.int))
            .groupBy('string', 'int')
            .orderBy('string', { direction: 'desc' })
            .orderBy('int')
            .build(),
        );

        expect(result).toEqual([
          { string: 'group3', count: 2n, sum: 25, min: 5 },
          { string: 'group2', count: 1n, sum: 10, min: 5 },
          { string: 'group1', count: 1n, sum: 5.5, min: 0 },
          { string: 'group1', count: 1n, sum: 10.1, min: 5 },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'applies scalar filters before grouping',
    () =>
      withMainGroupBy(async ({ db }) => {
        await db.public.A.createAll([
          { id: 1, float: 10.1, int: 5, string: 'group1' },
          { id: 2, float: 5.5, int: 0, string: 'group1' },
          { id: 3, float: 10, int: 5, string: 'group2' },
          { id: 4, float: 10, int: 5, string: 'group3' },
          { id: 5, float: 15, int: 5, string: 'group3' },
        ]);
        const query = mainSql(db);
        const result = await db.public.A.ctx.runtime.execute(
          query.public.a
            .select('string')
            .select('count', (fields, functions) => functions.count(fields.a.string))
            .select('sum', (fields, functions) => functions.sum(fields.a.float))
            .select('min', (fields, functions) => functions.min(fields.a.int))
            .where((fields, functions) =>
              functions.and(functions.eq(fields.a.int, 5), functions.lt(fields.a.float, 15)),
            )
            .groupBy('string', 'int')
            .orderBy('string', { direction: 'desc' })
            .build(),
        );

        expect(result).toEqual([
          { string: 'group3', count: 1n, sum: 10, min: 5 },
          { string: 'group2', count: 1n, sum: 10, min: 5 },
          { string: 'group1', count: 1n, sum: 10.1, min: 5 },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'applies relation filters before grouping',
    () =>
      withMainGroupBy(async ({ db }) => {
        await db.public.A.create({
          id: 1,
          float: 10.1,
          int: 5,
          string: 'group1',
          b: (relation) => relation.create({ id: 1, field: 'a' }),
        });
        await db.public.A.create({ id: 2, float: 5.5, int: 0, string: 'group1' });
        await db.public.A.create({ id: 3, float: 10, int: 5, string: 'group2' });
        await db.public.A.create({
          id: 4,
          float: 10,
          int: 5,
          string: 'group3',
          b: (relation) => relation.create({ id: 2, field: 'b' }),
        });
        await db.public.A.create({
          id: 5,
          float: 15,
          int: 5,
          string: 'group3',
          b: (relation) => relation.create({ id: 3, field: 'b' }),
        });

        const query = mainSql(db);
        const selectedRelations = () =>
          query.public.a
            .innerJoin(query.public.b, (fields, functions) =>
              functions.eq(fields.a.b_id, fields.b.id),
            )
            .select('string')
            .select('count', (fields, functions) => functions.count(fields.a.string))
            .select('sum', (fields, functions) => functions.sum(fields.a.float))
            .select('min', (fields, functions) => functions.min(fields.a.int));
        const relationExists = await db.public.A.ctx.runtime.execute(
          selectedRelations()
            .groupBy('string', 'int')
            .orderBy('string', { direction: 'desc' })
            .build(),
        );
        const relationFieldB = await db.public.A.ctx.runtime.execute(
          selectedRelations()
            .where((fields, functions) => functions.eq(fields.b.field, 'b'))
            .groupBy('string', 'int')
            .orderBy('string', { direction: 'desc' })
            .build(),
        );

        expect(relationExists).toEqual([
          { string: 'group3', count: 2n, sum: 25, min: 5 },
          { string: 'group1', count: 1n, sum: 10.1, min: 5 },
        ]);
        expect(relationFieldB).toEqual([{ string: 'group3', count: 2n, sum: 25, min: 5 }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'orders groups by count aggregation',
    () =>
      withMainGroupBy(async ({ db }) => {
        await seedOrderingRows(db);
        const query = mainSql(db);
        const grouped = () =>
          query.public.a
            .select('float')
            .select('count', (fields, functions) => functions.count(fields.a.float))
            .groupBy('float');
        const ascending = await db.public.A.ctx.runtime.execute(
          grouped()
            .orderBy((fields, functions) => functions.count(fields.a.float))
            .build(),
        );
        const descending = await db.public.A.ctx.runtime.execute(
          grouped()
            .orderBy((fields, functions) => functions.count(fields.a.float), {
              direction: 'desc',
            })
            .build(),
        );

        expect(ascending).toEqual([
          { float: 4, count: 1n },
          { float: 1.1, count: 3n },
        ]);
        expect(descending).toEqual([
          { float: 1.1, count: 3n },
          { float: 4, count: 1n },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'orders groups by sum aggregation',
    () =>
      withMainGroupBy(async ({ db }) => {
        await seedOrderingRows(db);
        const query = mainSql(db);
        const grouped = () =>
          query.public.a
            .select('float')
            .select('sum', (fields, functions) => functions.sum(fields.a.float))
            .groupBy('float');
        const ascending = await db.public.A.ctx.runtime.execute(
          grouped()
            .orderBy((fields, functions) => functions.sum(fields.a.float))
            .build(),
        );
        const descending = await db.public.A.ctx.runtime.execute(
          grouped()
            .orderBy((fields, functions) => functions.sum(fields.a.float), {
              direction: 'desc',
            })
            .build(),
        );

        expect(ascending).toEqual([
          { float: 1.1, sum: 3.3000000000000003 },
          { float: 4, sum: 4 },
        ]);
        expect(descending).toEqual([
          { float: 4, sum: 4 },
          { float: 1.1, sum: 3.3000000000000003 },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  for (const operation of ['avg', 'min', 'max'] as const) {
    it(
      `orders groups by ${operation} aggregation`,
      () =>
        withMainGroupBy(async ({ db }) => {
          await seedOrderingRows(db);
          const query = mainSql(db);
          const grouped = () =>
            query.public.a
              .select('float')
              .select(operation, (fields, functions) => functions[operation](fields.a.float))
              .groupBy('float');
          const ascending = await db.public.A.ctx.runtime.execute(
            grouped()
              .orderBy((fields, functions) => functions[operation](fields.a.float))
              .build(),
          );
          const descending = await db.public.A.ctx.runtime.execute(
            grouped()
              .orderBy((fields, functions) => functions[operation](fields.a.float), {
                direction: 'desc',
              })
              .build(),
          );

          expect(ascending).toEqual([
            { float: 1.1, [operation]: 1.1 },
            { float: 4, [operation]: 4 },
          ]);
          expect(descending).toEqual([
            { float: 4, [operation]: 4 },
            { float: 1.1, [operation]: 1.1 },
          ]);
        }),
      timeouts.spinUpPpgDev,
    );
  }

  it(
    'orders groups by multiple aggregations',
    () =>
      withMainGroupBy(async ({ db }) => {
        await db.public.A.createAll([
          { id: 1, float: 1.1, int: 1, string: 'group1' },
          { id: 2, float: 1.1, int: 1, string: 'group1' },
          { id: 3, float: 1.1, int: 1, string: 'group2' },
          { id: 4, float: 3, int: 3, string: 'group3' },
          { id: 5, float: 4, int: 4, string: 'group3' },
        ]);
        const query = mainSql(db);
        const result = await db.public.A.ctx.runtime.execute(
          query.public.a
            .select('float')
            .select('count', (fields, functions) => functions.count(fields.a.float))
            .select('sum', (fields, functions) => functions.sum(fields.a.int))
            .groupBy('float', 'int')
            .orderBy((fields, functions) => functions.count(fields.a.float), {
              direction: 'desc',
            })
            .orderBy((fields, functions) => functions.sum(fields.a.int))
            .build(),
        );

        expect(result).toEqual([
          { float: 1.1, count: 3n, sum: 3n },
          { float: 3, count: 1n, sum: 3n },
          { float: 4, count: 1n, sum: 4n },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'combines aggregate ordering with having',
    () =>
      withMainGroupBy(async ({ db }) => {
        await db.public.A.createAll([
          { id: 1, float: 1.1, int: 1, string: 'group1' },
          { id: 2, float: 1.1, int: 1, string: 'group1' },
          { id: 3, float: 1.1, int: 1, string: 'group2' },
          { id: 4, float: 3, int: 3, string: 'group3' },
          { id: 5, float: 4, int: 4, string: 'group3' },
        ]);
        const query = mainSql(db);
        const result = await db.public.A.ctx.runtime.execute(
          query.public.a
            .select('float')
            .select('count', (fields, functions) => functions.count(fields.a.float))
            .select('sum', (fields, functions) => functions.sum(fields.a.int))
            .groupBy('float', 'int')
            .having((fields, functions) => functions.lt(fields.a.float, 4))
            .orderBy((fields, functions) => functions.count(fields.a.float), {
              direction: 'desc',
            })
            .orderBy((fields, functions) => functions.sum(fields.a.int))
            .build(),
        );

        expect(result).toEqual([
          { float: 1.1, count: 3n, sum: 3n },
          { float: 3, count: 1n, sum: 3n },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'orders by an aggregation without selecting it',
    () =>
      withMainGroupBy(async ({ db }) => {
        await db.public.A.createAll([
          { id: 1, float: 1.1, int: 1, string: 'group1' },
          { id: 2, float: 1.1, int: 1, string: 'group1' },
          { id: 3, float: 1.1, int: 1, string: 'group2' },
        ]);
        const query = mainSql(db);
        const result = await db.public.A.ctx.runtime.execute(
          query.public.a
            .select('sum', (fields, functions) => functions.sum(fields.a.int))
            .groupBy('float')
            .orderBy((fields, functions) => functions.count(fields.a.float), {
              direction: 'desc',
            })
            .build(),
        );

        expect(result).toEqual([{ sum: 3n }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'computes enum extrema globally and per group',
    () =>
      withPostgresPort<Regression21789Contract>(
        { contractJson: regression21789ContractJson },
        async ({ db }) => {
          await db.public.Test.createAll([
            { id: 1, group: 1, color: 'red' },
            { id: 2, group: 2, color: 'green' },
            { id: 3, group: 1, color: 'blue' },
          ]);

          const collection = db.public.Test;
          const query = sql<Regression21789Contract>({
            context: collection.ctx.context,
            rawCodecInferer: postgresRawCodecInferer,
          });
          const aggregateResult = await collection.ctx.runtime.execute(
            query.public.test
              .select('max', (fields, functions) => functions.max(fields.test.color))
              .select('min', (fields, functions) => functions.min(fields.test.color))
              .build(),
          );
          const groupedResult = await collection.ctx.runtime.execute(
            query.public.test
              .select('group')
              .select('max', (fields, functions) => functions.max(fields.test.color))
              .select('min', (fields, functions) => functions.min(fields.test.color))
              .groupBy('group')
              .orderBy('group')
              .build(),
          );

          expect(aggregateResult).toEqual([{ max: 'green', min: 'blue' }]);
          expect(groupedResult).toEqual([
            { group: 1, max: 'red', min: 'blue' },
            { group: 2, max: 'green', min: 'green' },
          ]);
        },
      ),
    timeouts.spinUpPpgDev,
  );
});
