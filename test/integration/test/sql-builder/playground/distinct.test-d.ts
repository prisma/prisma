import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { expectTypeOf, test } from 'vitest';
import { db } from './preamble';

test('distinct() on a basic select', () => {
  const distinctUsers = db.public.users.select('name', 'email').distinct().build();

  expectTypeOf(distinctUsers).toEqualTypeOf<SqlQueryPlan<{ name: string; email: string }>>();
});

test('distinctOn with a single column name', () => {
  const distinctOnName = db.public.users
    .select('name', 'email')
    .distinctOn('name')
    .orderBy('name')
    .build();

  expectTypeOf(distinctOnName).toEqualTypeOf<SqlQueryPlan<{ name: string; email: string }>>();
});

test('distinctOn with multiple column names', () => {
  const distinctOnMulti = db.public.users
    .select('name', 'email')
    .distinctOn('name', 'email')
    .orderBy('name')
    .build();

  expectTypeOf(distinctOnMulti).toEqualTypeOf<SqlQueryPlan<{ name: string; email: string }>>();
});

test('distinctOn with expression callback', () => {
  const distinctOnExpr = db.public.users
    .select('name', 'email')
    .distinctOn((f) => f.name)
    .orderBy('name')
    .build();

  expectTypeOf(distinctOnExpr).toEqualTypeOf<SqlQueryPlan<{ name: string; email: string }>>();
});

test('distinctOn with joined tables — namespace access in expression', () => {
  const distinctOnJoin = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .select('name', 'title')
    .distinctOn((f) => f.users.name)
    .orderBy((f) => f.users.name)
    .build();

  expectTypeOf(distinctOnJoin).toEqualTypeOf<SqlQueryPlan<{ name: string; title: string }>>();
});

test('distinct() on a grouped query', () => {
  const distinctGrouped = db.public.users
    .select('name')
    .select('cnt', (_f, fns) => fns.count())
    .groupBy('name')
    .distinct()
    .build();

  expectTypeOf(distinctGrouped).toEqualTypeOf<SqlQueryPlan<{ name: string; cnt: number }>>();
});

test('distinctOn on a grouped query', () => {
  const distinctOnGrouped = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .select('name')
    .select('postCount', (_f, fns) => fns.count())
    .groupBy('name')
    .distinctOn('name')
    .orderBy('name')
    .build();

  expectTypeOf(distinctOnGrouped).toEqualTypeOf<
    SqlQueryPlan<{ name: string; postCount: number }>
  >();
});

test('distinctOn referencing scope field not in select', () => {
  const distinctOnScope = db.public.users.select('name').distinctOn('id').orderBy('id').build();

  expectTypeOf(distinctOnScope).toEqualTypeOf<SqlQueryPlan<{ name: string }>>();
});
