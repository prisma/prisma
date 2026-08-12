import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { expectTypeOf, test } from 'vitest';
import { db } from './preamble';

test('limit with literal number', () => {
  const literalLimit = db.public.users.select('id', 'name').limit(10).build();

  expectTypeOf(literalLimit).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});

test('offset with literal number', () => {
  const literalOffset = db.public.users.select('id', 'name').offset(5).build();

  expectTypeOf(literalOffset).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});

test('both limit and offset with literal numbers', () => {
  const both = db.public.users.select('id', 'name').limit(10).offset(5).build();

  expectTypeOf(both).toEqualTypeOf<SqlQueryPlan<{ id: number; name: string }>>();
});

test('pagination after join preserves row type', () => {
  const joined = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.user_id))
    .select('name', 'title')
    .limit(10)
    .offset(5)
    .build();

  expectTypeOf(joined).toEqualTypeOf<SqlQueryPlan<{ name: string; title: string }>>();
});
