import type { SqlQueryPlan } from '@prisma-next/sql-relational-core/plan';
import { expectTypeOf, test } from 'vitest';
import { db } from './preamble';

test('basic groupBy with count', () => {
  const postsPerUser = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .select('name')
    .select('postCount', (_f, fns) => fns.count())
    .groupBy('name')
    .build();

  expectTypeOf(postsPerUser).toEqualTypeOf<SqlQueryPlan<{ name: string; postCount: bigint }>>();
});

test('groupBy with select alias', () => {
  const byAlias = db.public.users
    .select('author', (f) => f.name)
    .select('total', (_f, fns) => fns.count())
    .groupBy('author')
    .build();

  expectTypeOf(byAlias).toEqualTypeOf<SqlQueryPlan<{ author: string; total: bigint }>>();
});

test('HAVING with aggregate expression', () => {
  const activeAuthors = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .select('name')
    .select('postCount', (f, fns) => fns.count(f.posts.id))
    .groupBy('name')
    .having((_f, fns) => fns.gt(fns.count(), 5n))
    .build();

  expectTypeOf(activeAuthors).toEqualTypeOf<SqlQueryPlan<{ name: string; postCount: bigint }>>();
});

test('HAVING referencing a select alias', () => {
  const havingAlias = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .select('name')
    .select('postCount', (_f, fns) => fns.count())
    .groupBy('name')
    .having((f, fns) => fns.gt(f.postCount, 5n))
    .build();

  expectTypeOf(havingAlias).toEqualTypeOf<SqlQueryPlan<{ name: string; postCount: bigint }>>();
});

test('chained groupBy', () => {
  const multiGroup = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .select('name', 'title')
    .select('cnt', (_f, fns) => fns.count())
    .groupBy('name')
    .groupBy('title')
    .build();

  expectTypeOf(multiGroup).toEqualTypeOf<
    SqlQueryPlan<{ name: string; title: string; cnt: bigint }>
  >();
});

test('groupBy with expression', () => {
  const byExpr = db.public.users
    .select('email')
    .select('userCount', (_f, fns) => fns.count())
    .groupBy((f) => f.email)
    .build();

  expectTypeOf(byExpr).toEqualTypeOf<SqlQueryPlan<{ email: string; userCount: bigint }>>();
});

test('ORDER BY aggregate on grouped query', () => {
  const orderedGroup = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .select('name')
    .select('postCount', (_f, fns) => fns.count())
    .groupBy('name')
    .orderBy((_f, fns) => fns.count(), { direction: 'desc' })
    .limit(10)
    .build();

  expectTypeOf(orderedGroup).toEqualTypeOf<SqlQueryPlan<{ name: string; postCount: bigint }>>();
});

test('grouped subquery as join source', () => {
  const withCounts = db.public.users
    .innerJoin(
      db.public.posts
        .select('user_id')
        .select('postCount', (_f, fns) => fns.count())
        .groupBy('user_id')
        .as('pc'),
      (f, fns) => fns.eq(f.users.id, f.pc.user_id),
    )
    .select((f) => ({ name: f.users.name, postCount: f.pc.postCount }))
    .build();

  expectTypeOf(withCounts).toEqualTypeOf<SqlQueryPlan<{ name: string; postCount: bigint }>>();
});

test('sum/avg/min/max aggregate functions', () => {
  const aggregates = db.public.posts
    .select('totalViews', (f, fns) => fns.sum(f.views))
    .select('avgViews', (f, fns) => fns.avg(f.views))
    .select('minViews', (f, fns) => fns.min(f.views))
    .select('maxViews', (f, fns) => fns.max(f.views))
    .groupBy((f) => f.user_id)
    .build();

  expectTypeOf(aggregates).toEqualTypeOf<
    SqlQueryPlan<{
      totalViews: number | null;
      avgViews: number | null;
      minViews: number | null;
      maxViews: number | null;
    }>
  >();
});

test('aggregates in select are allowed (fns.count available)', () => {
  const selectAgg = db.public.users
    .select('name')
    .select('cnt', (_f, fns) => fns.count())
    .build();

  expectTypeOf(selectAgg).toEqualTypeOf<SqlQueryPlan<{ name: string; cnt: bigint }>>();
});

test('aggregates in WHERE — type error', () => {
  db.public.users
    .select('name')
    // @ts-expect-error count is not available in where (Functions, not AggregateFunctions)
    .where((_f, fns) => fns.gt(fns.count(), 5))
    .build();
});

test('HAVING without GROUP BY — type error', () => {
  db.public.users
    .select('name')
    // @ts-expect-error having only exists on GroupedQuery, not SelectQuery
    .having((_f, fns) => fns.gt(fns.count(), 5))
    .build();
});
