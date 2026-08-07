import { and, not } from '@internal/sql-orm-client';
import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

type Db = Parameters<Parameters<typeof withPostgresPort<Contract>>[1]>[0]['db'];

async function seed(db: Db, strings: readonly (string | null)[]) {
  await db.public.ModelB.create({ id: 'b1', int: 1 });
  await db.public.ModelA.createAll(
    strings.map((optString, index) => ({
      id: `row-${index + 1}`,
      idTest: `id${index + 1}`,
      optString,
      optInt: 1,
      optFloat: 1,
      optBoolean: index === 0,
      optDateTime: new Date('2016-09-23T12:29:32.342Z'),
      optEnum: 'A' as const,
      b_id: 'b1',
    })),
  );
}

function withPortedFilters(fn: Parameters<typeof withPostgresPort<Contract>>[1]) {
  return withPostgresPort<Contract>({ contractJson }, fn);
}

async function ids(query: PromiseLike<readonly { idTest: string | null }[]>) {
  return query;
}

describe('ports/engines/queries/filters/ported_filters', () => {
  it(
    'filter_null',
    () =>
      withPortedFilters(async ({ db }) => {
        await seed(db, [null, 'foo bar', null]);
        const isNull = () =>
          db.public.ModelA.where((a) => a.optString.isNull())
            .orderBy((a) => a.id.asc())
            .select('idTest')
            .all();
        const relationAndNull = () =>
          db.public.ModelA.where((a) =>
            and(
              a.b.some((b) => b.int.eq(1)),
              a.optString.isNull(),
            ),
          )
            .orderBy((a) => a.id.asc())
            .select('idTest')
            .all();
        const isNotNull = () =>
          db.public.ModelA.where((a) => a.optString.isNotNull())
            .orderBy((a) => a.id.asc())
            .select('idTest')
            .all();
        const relationAndNotNull = () =>
          db.public.ModelA.where((a) =>
            and(
              a.b.some((b) => b.int.eq(1)),
              a.optString.isNotNull(),
            ),
          )
            .orderBy((a) => a.id.asc())
            .select('idTest')
            .all();
        expect(await ids(isNull())).toEqual([{ idTest: 'id1' }, { idTest: 'id3' }]);
        expect(await ids(relationAndNull())).toEqual([{ idTest: 'id1' }, { idTest: 'id3' }]);
        expect(await ids(isNotNull())).toEqual([{ idTest: 'id2' }]);
        expect(await ids(isNotNull())).toEqual([{ idTest: 'id2' }]);
        expect(
          await ids(
            db.public.ModelA.where((a) => not(not(not(a.optString.isNull()))))
              .orderBy((a) => a.id.asc())
              .select('idTest')
              .all(),
          ),
        ).toEqual([{ idTest: 'id2' }]);
        expect(
          await ids(
            db.public.ModelA.where((a) => not(not(not(a.optString.isNull()))))
              .orderBy((a) => a.id.asc())
              .select('idTest')
              .all(),
          ),
        ).toEqual([{ idTest: 'id2' }]);
        expect(await ids(relationAndNotNull())).toEqual([{ idTest: 'id2' }]);
        expect(await ids(isNull())).toEqual([{ idTest: 'id1' }, { idTest: 'id3' }]);
        expect(await ids(relationAndNull())).toEqual([{ idTest: 'id1' }, { idTest: 'id3' }]);
        expect(await ids(isNotNull())).toEqual([{ idTest: 'id2' }]);
        expect(await ids(relationAndNotNull())).toEqual([{ idTest: 'id2' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'str_eq',
    () =>
      withPortedFilters(async ({ db }) => {
        await seed(db, ['bar', 'foo bar', 'foo bar barz']);
        expect(
          await ids(
            db.public.ModelA.where((a) => a.optString.eq('bar'))
              .select('idTest')
              .all(),
          ),
        ).toEqual([{ idTest: 'id1' }]);
        expect(
          await ids(
            db.public.ModelA.where((a) =>
              and(
                a.b.some((b) => b.int.eq(1)),
                a.optString.eq('bar'),
              ),
            )
              .select('idTest')
              .all(),
          ),
        ).toEqual([{ idTest: 'id1' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'str_not_eq',
    () =>
      withPortedFilters(async ({ db }) => {
        await seed(db, ['bar', 'foo bar', 'foo bar barz']);
        expect(
          await ids(
            db.public.ModelA.where((a) => not(a.optString.eq('bar')))
              .orderBy((a) => a.id.asc())
              .select('idTest')
              .all(),
          ),
        ).toEqual([{ idTest: 'id2' }, { idTest: 'id3' }]);
        expect(
          await ids(
            db.public.ModelA.where((a) =>
              and(
                a.b.some((b) => b.int.eq(1)),
                not(a.optString.eq('bar')),
              ),
            )
              .orderBy((a) => a.id.asc())
              .select('idTest')
              .all(),
          ),
        ).toEqual([{ idTest: 'id2' }, { idTest: 'id3' }]);
      }),
    timeouts.spinUpPpgDev,
  );
});
