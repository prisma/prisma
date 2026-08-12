import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import { expectTypeOf, test } from 'vitest';
import { db } from './preamble';

test('basic lateral join — user with latest post title', () => {
  const lateral = db.public.users
    .lateralJoin('latestPost', (lateral) =>
      lateral
        .from(db.public.posts)
        .select('title')
        .where((f, fns) => fns.eq(f.users.id, f.posts.user_id)),
    )
    .select((f) => ({
      userName: f.users.name,
      postTitle: f.latestPost.title,
    }))
    .build();

  expectTypeOf(lateral).toEqualTypeOf<SqlQueryPlan<{ userName: string; postTitle: string }>>();
});

test('outer lateral join — nullable result columns', () => {
  const outerLateral = db.public.users
    .outerLateralJoin('latestPost', (lateral) =>
      lateral
        .from(db.public.posts)
        .select('title')
        .where((f, fns) => fns.eq(f.users.id, f.posts.user_id)),
    )
    .select((f) => ({
      userName: f.users.name,
      postTitle: f.latestPost.title,
    }))
    .build();

  expectTypeOf(outerLateral).toEqualTypeOf<
    SqlQueryPlan<{ userName: string; postTitle: string | null }>
  >();
});

test('lateral join chained with regular join', () => {
  const lateralWithJoin = db.public.users
    .innerJoin(db.public.posts, (f, fns) => fns.eq(f.users.id, f.posts.user_id))
    .lateralJoin('sub', (lateral) =>
      lateral.from(db.public.posts.as('p2')).select((f) => ({ subTitle: f.p2.title })),
    )
    .select((f) => ({
      userName: f.users.name,
      subTitle: f.sub.subTitle,
    }))
    .build();

  expectTypeOf(lateralWithJoin).toEqualTypeOf<
    SqlQueryPlan<{ userName: string; subTitle: string }>
  >();
});

test('lateral subquery using expression select', () => {
  const lateralExpr = db.public.users
    .lateralJoin('computed', (lateral) =>
      lateral.from(db.public.posts).select('postTitle', (f) => f.posts.title),
    )
    .select((f) => ({
      userName: f.users.name,
      postTitle: f.computed.postTitle,
    }))
    .build();

  expectTypeOf(lateralExpr).toEqualTypeOf<SqlQueryPlan<{ userName: string; postTitle: string }>>();
});
