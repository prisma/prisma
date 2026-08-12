import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { expectTypeOf, test } from 'vitest';
import { db } from './preamble';

test('orderBy with select alias', () => {
  const ordered = db.public.users
    .select('authorName', (f) => f.name)
    .orderBy('authorName', { direction: 'desc', nulls: 'last' })
    .build();

  expectTypeOf(ordered).toEqualTypeOf<SqlQueryPlan<{ authorName: string }>>();
});

test('orderBy with expression referencing alias', () => {
  const orderedExpr = db.public.users
    .select('authorName', (f) => f.name)
    .orderBy((f) => f.authorName, { direction: 'asc' })
    .build();

  expectTypeOf(orderedExpr).toEqualTypeOf<SqlQueryPlan<{ authorName: string }>>();
});

test('orderBy with scope field not in select', () => {
  const orderedScope = db.public.users.select('name').orderBy('id').build();

  expectTypeOf(orderedScope).toEqualTypeOf<SqlQueryPlan<{ name: string }>>();
});
