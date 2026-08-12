import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { expectTypeOf, test } from 'vitest';
import { db } from './preamble';

test('basic multi-column select', () => {
  const simple = db.public.users
    .select('id', 'email')
    .where((c, fns) => fns.eq(c.invited_by_id, c.id))
    .build();

  expectTypeOf(simple).toEqualTypeOf<SqlQueryPlan<{ id: number; email: string }>>();
});

test('aliased expression select after join', () => {
  const aliasedExpr = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.user_id))
    .select('authorName', (f) => f.users.name)
    .build();

  expectTypeOf(aliasedExpr).toEqualTypeOf<SqlQueryPlan<{ authorName: string }>>();
});

test('bulk record select', () => {
  const bulk = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.user_id))
    .select((f) => ({ userName: f.name, mail: f.email, postTitle: f.posts.title }))
    .build();

  expectTypeOf(bulk).toEqualTypeOf<
    SqlQueryPlan<{ userName: string; mail: string; postTitle: string }>
  >();
});

test('mixed usage combining all overloads', () => {
  const mixed = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.user_id))
    .select('email', 'views')
    .select('authorName', (f) => f.users.name)
    .select((f) => ({ id: f.users.id, postTitle: f.title }))
    .build();

  expectTypeOf(mixed).toEqualTypeOf<
    SqlQueryPlan<{
      id: number;
      views: number;
      email: string;
      authorName: string;
      postTitle: string;
    }>
  >();
});
