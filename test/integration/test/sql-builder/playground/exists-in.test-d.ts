import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { expectTypeOf, test } from 'vitest';
import { db } from './preamble';

test('EXISTS — users who have posts', () => {
  const withPosts = db.public.users
    .select('id', 'name')
    .where((f, fns) =>
      fns.exists(db.public.posts.select('id').where((pf, pfns) => pfns.eq(pf.user_id, f.users.id))),
    )
    .build();

  expectTypeOf(withPosts).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});

test('NOT EXISTS — users without posts', () => {
  const withoutPosts = db.public.users
    .select('id', 'name')
    .where((f, fns) =>
      fns.notExists(
        db.public.posts.select('id').where((pf, pfns) => pfns.eq(pf.user_id, f.users.id)),
      ),
    )
    .build();

  expectTypeOf(withoutPosts).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});

test('IN with subquery', () => {
  const inSubquery = db.public.users
    .select('id', 'name')
    .where((f, fns) => fns.in(f.users.id, db.public.posts.select('user_id')))
    .build();

  expectTypeOf(inSubquery).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});

test('IN with literal array', () => {
  const inLiteral = db.public.users
    .select('id', 'name')
    .where((f, fns) => fns.in(f.users.id, [1, 2, 3]))
    .build();

  expectTypeOf(inLiteral).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});

test('IN with expression array', () => {
  const inExpressions = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .select('name')
    .where((f, fns) => fns.in(f.users.id, [f.posts.user_id]))
    .build();

  expectTypeOf(inExpressions).toEqualTypeOf<SqlQueryPlan<{ name: string }>>();
});

test('IN with mixed array (literals + expressions)', () => {
  const inMixed = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .select('name')
    .where((f, fns) => fns.in(f.users.id, [1, f.posts.user_id, 3]))
    .build();

  expectTypeOf(inMixed).toEqualTypeOf<SqlQueryPlan<{ name: string }>>();
});

test('NOT IN with subquery', () => {
  const notInSubquery = db.public.users
    .select('id', 'name')
    .where((f, fns) => fns.notIn(f.users.id, db.public.posts.select('user_id')))
    .build();

  expectTypeOf(notInSubquery).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});

test('NOT IN with literal array', () => {
  const notInLiteral = db.public.users
    .select('id', 'name')
    .where((f, fns) => fns.notIn(f.users.id, [1, 2, 3]))
    .build();

  expectTypeOf(notInLiteral).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});

test('type-mismatched subquery — title is text, id is int4', () => {
  db.public.users
    .select('id')
    // @ts-expect-error type mismatch: title (text) is not compatible with id (int4)
    .where((f, fns) => fns.in(f.users.id, db.public.posts.select('title')))
    .build();
});

test('multi-column subquery with different types', () => {
  db.public.users
    .select('id')
    // @ts-expect-error multi-column subquery not allowed in scalar IN
    .where((f, fns) => fns.in(f.users.id, db.public.posts.select('user_id', 'title')))
    .build();
});

test('type-mismatched literal array — strings vs int expression', () => {
  db.public.users
    .select('id')
    // @ts-expect-error string array not compatible with int4 column
    .where((f, fns) => fns.in(f.users.id, ['hello', 'world']))
    .build();
});

test('EXISTS with grouped subquery', () => {
  const existsGrouped = db.public.users
    .select('id', 'name')
    .where((_f, fns) =>
      fns.exists(
        db.public.posts
          .select('user_id')
          .select('cnt', (_pf, pfns) => pfns.count())
          .groupBy('user_id')
          .having((_pf, pfns) => pfns.gt(pfns.count(), 5)),
      ),
    )
    .build();

  expectTypeOf(existsGrouped).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});
