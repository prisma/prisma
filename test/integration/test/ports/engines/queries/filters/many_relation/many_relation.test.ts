import { and } from '@internal/sql-orm-client';
import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract as Contract23742 } from './_fixture/23742/generated/contract';
import contract23742Json from './_fixture/23742/generated/contract.json' with { type: 'json' };
import type { Contract as Contract25103 } from './_fixture/25103/generated/contract';
import contract25103Json from './_fixture/25103/generated/contract.json' with { type: 'json' };
import type { Contract as Contract25104 } from './_fixture/25104/generated/contract';
import contract25104Json from './_fixture/25104/generated/contract.json' with { type: 'json' };
import type { Contract as CommonContract } from './_fixture/common/generated/contract';
import commonContractJson from './_fixture/common/generated/contract.json' with { type: 'json' };
import type { Contract as DifferentPkContract } from './_fixture/different-pk/generated/contract';
import differentPkContractJson from './_fixture/different-pk/generated/contract.json' with {
  type: 'json',
};
import type { Contract as L2ToOneContract } from './_fixture/l2-to-one/generated/contract';
import l2ToOneContractJson from './_fixture/l2-to-one/generated/contract.json' with {
  type: 'json',
};

async function seedCommon(
  db: Parameters<Parameters<typeof withPostgresPort<CommonContract>>[1]>[0]['db'],
) {
  await db.public.Blog.createAll([
    { id: 'blog-1', name: 'blog 1' },
    { id: 'blog-2', name: 'blog 2' },
  ]);
  await db.public.Post.createAll([
    { id: 'post-1', title: 'post 1', popularity: 10, blog_id: 'blog-1' },
    { id: 'post-2', title: 'post 2', popularity: 2, blog_id: 'blog-1' },
    { id: 'post-3', title: 'post 3', popularity: 1000, blog_id: 'blog-2' },
  ]);
  await db.public.Comment.createAll([
    { id: 'comment-1', text: 'comment 1', likes: 0, post_id: 'post-1' },
    { id: 'comment-2', text: 'comment 2', likes: 5, post_id: 'post-1' },
    { id: 'comment-3', text: 'comment 3', likes: 10, post_id: 'post-1' },
    { id: 'comment-4', text: 'comment 4', likes: 10, post_id: 'post-2' },
    { id: 'comment-5', text: 'comment 5', likes: 1000, post_id: 'post-3' },
  ]);
}

function withCommon(fn: Parameters<typeof withPostgresPort<CommonContract>>[1]) {
  return withPostgresPort<CommonContract>({ contractJson: commonContractJson }, async (ctx) => {
    await seedCommon(ctx.db);
    await fn(ctx);
  });
}

async function names(query: PromiseLike<readonly { name: string }[]>) {
  return query;
}

describe('ports/engines/queries/filters/many_relation', () => {
  it(
    'simple_scalar_filter',
    () =>
      withCommon(async ({ db }) => {
        const result = await db.public.Blog.orderBy((blog) => blog.id.asc())
          .select('id')
          .include('posts', (posts) =>
            posts
              .where((post) => post.popularity.gte(5))
              .orderBy((post) => post.id.asc())
              .select('title'),
          )
          .all();
        expect(result).toEqual([
          { id: 'blog-1', posts: [{ title: 'post 1' }] },
          { id: 'blog-2', posts: [{ title: 'post 3' }] },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l1_1_rel',
    () =>
      withCommon(async ({ db }) => {
        const result = await db.public.Post.where((post) =>
          post.blog.some((blog) => blog.name.eq('blog 1')),
        )
          .orderBy((post) => post.id.asc())
          .select('title')
          .all();
        expect(result).toEqual([{ title: 'post 1' }, { title: 'post 2' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l1_m_rel_some',
    () =>
      withCommon(async ({ db }) => {
        expect(
          await names(
            db.public.Blog.where((blog) => blog.posts.some((post) => post.popularity.gte(5)))
              .orderBy((blog) => blog.id.asc())
              .select('name')
              .all(),
          ),
        ).toEqual([{ name: 'blog 1' }, { name: 'blog 2' }]);
        expect(
          await names(
            db.public.Blog.where((blog) => blog.posts.some((post) => post.popularity.gte(50)))
              .select('name')
              .all(),
          ),
        ).toEqual([{ name: 'blog 2' }]);
        expect(
          await names(
            db.public.Blog.where((blog) =>
              blog.posts.some((post) => and(post.title.eq('post 1'), post.title.eq('post 2'))),
            )
              .select('name')
              .all(),
          ),
        ).toEqual([]);
        expect(
          await names(
            db.public.Blog.where((blog) =>
              and(
                blog.posts.some((post) => post.title.eq('post 1')),
                blog.posts.some((post) => post.title.eq('post 2')),
              ),
            )
              .select('name')
              .all(),
          ),
        ).toEqual([{ name: 'blog 1' }]);
        expect(
          await names(
            db.public.Blog.where((blog) =>
              blog.posts.some((post) => and(post.title.eq('post 1'), post.popularity.gte(2))),
            )
              .select('name')
              .all(),
          ),
        ).toEqual([{ name: 'blog 1' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l1_m_rel_every',
    () =>
      withCommon(async ({ db }) => {
        expect(
          await names(
            db.public.Blog.where((blog) => blog.posts.every((post) => post.popularity.gte(2)))
              .orderBy((blog) => blog.id.asc())
              .select('name')
              .all(),
          ),
        ).toEqual([{ name: 'blog 1' }, { name: 'blog 2' }]);
        expect(
          await names(
            db.public.Blog.where((blog) => blog.posts.every((post) => post.popularity.gte(3)))
              .select('name')
              .all(),
          ),
        ).toEqual([{ name: 'blog 2' }]);
        expect(
          await names(
            db.public.Blog.where((blog) =>
              blog.posts.some((post) => and(post.title.eq('post 1'), post.title.eq('post 2'))),
            )
              .select('name')
              .all(),
          ),
        ).toEqual([]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l1_m_rel_none',
    () =>
      withCommon(async ({ db }) => {
        expect(
          await names(
            db.public.Blog.where((blog) => blog.posts.none((post) => post.popularity.gte(50)))
              .select('name')
              .all(),
          ),
        ).toEqual([{ name: 'blog 1' }]);
        expect(
          await names(
            db.public.Blog.where((blog) => blog.posts.none((post) => post.popularity.gte(5)))
              .select('name')
              .all(),
          ),
        ).toEqual([]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l2_m_rel_some_some',
    () =>
      withCommon(async ({ db }) => {
        expect(
          await names(
            db.public.Blog.where((blog) =>
              blog.posts.some((post) => post.comments.some((comment) => comment.likes.eq(0))),
            )
              .select('name')
              .all(),
          ),
        ).toEqual([{ name: 'blog 1' }]);
        expect(
          await names(
            db.public.Blog.where((blog) =>
              blog.posts.some((post) => post.comments.some((comment) => comment.likes.eq(1))),
            )
              .select('name')
              .all(),
          ),
        ).toEqual([]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l2_m_rel_all',
    () =>
      withCommon(async ({ db }) => {
        const query = db.public.Blog.orderBy((blog) => blog.id.asc()).select('name');
        expect(
          await query
            .where((blog) => blog.posts.some((post) => post.comments.every((c) => c.likes.gte(0))))
            .all(),
        ).toEqual([{ name: 'blog 1' }, { name: 'blog 2' }]);
        expect(
          await query
            .where((blog) => blog.posts.some((post) => post.comments.every((c) => c.likes.eq(0))))
            .all(),
        ).toEqual([]);
        expect(
          await query
            .where((blog) => blog.posts.some((post) => post.comments.none((c) => c.likes.eq(0))))
            .all(),
        ).toEqual([{ name: 'blog 1' }, { name: 'blog 2' }]);
        expect(
          await query
            .where((blog) => blog.posts.some((post) => post.comments.none((c) => c.likes.gte(0))))
            .all(),
        ).toEqual([]);
        expect(
          await query
            .where((blog) => blog.posts.every((post) => post.comments.some((c) => c.likes.eq(10))))
            .all(),
        ).toEqual([{ name: 'blog 1' }]);
        expect(
          await query
            .where((blog) => blog.posts.every((post) => post.comments.some((c) => c.likes.eq(0))))
            .all(),
        ).toEqual([]);
        expect(
          await query
            .where((blog) => blog.posts.every((post) => post.comments.every((c) => c.likes.gte(0))))
            .all(),
        ).toEqual([{ name: 'blog 1' }, { name: 'blog 2' }]);
        expect(
          await query
            .where((blog) => blog.posts.every((post) => post.comments.every((c) => c.likes.eq(0))))
            .all(),
        ).toEqual([]);
        expect(
          await query
            .where((blog) =>
              blog.posts.every((post) => post.comments.none((c) => c.likes.gte(100))),
            )
            .all(),
        ).toEqual([{ name: 'blog 1' }]);
        expect(
          await query
            .where((blog) => blog.posts.every((post) => post.comments.none((c) => c.likes.eq(0))))
            .all(),
        ).toEqual([{ name: 'blog 2' }]);
        expect(
          await query
            .where((blog) => blog.posts.none((post) => post.comments.some((c) => c.likes.gte(100))))
            .all(),
        ).toEqual([{ name: 'blog 1' }]);
        expect(
          await query
            .where((blog) => blog.posts.none((post) => post.comments.some((c) => c.likes.eq(0))))
            .all(),
        ).toEqual([{ name: 'blog 2' }]);
        expect(
          await query
            .where((blog) => blog.posts.none((post) => post.comments.every((c) => c.likes.gte(11))))
            .all(),
        ).toEqual([{ name: 'blog 1' }]);
        expect(
          await query
            .where((blog) => blog.posts.none((post) => post.comments.every((c) => c.likes.gte(0))))
            .all(),
        ).toEqual([]);
        expect(
          await query
            .where((blog) => blog.posts.none((post) => post.comments.none((c) => c.likes.gte(0))))
            .all(),
        ).toEqual([{ name: 'blog 1' }, { name: 'blog 2' }]);
        expect(
          await query
            .where((blog) => blog.posts.none((post) => post.comments.none((c) => c.likes.gte(11))))
            .all(),
        ).toEqual([{ name: 'blog 2' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l2_m_1_rel_all',
    () =>
      withPostgresPort<L2ToOneContract>({ contractJson: l2ToOneContractJson }, async ({ db }) => {
        await db.public.Blog.createAll([
          { id: 1, name: 'blog1' },
          { id: 2, name: 'blog2' },
          { id: 3, name: 'blog3' },
          { id: 4, name: 'blog4' },
        ]);
        await db.public.Post.createAll([
          { id: 1, blog_id: 1 },
          { id: 2, blog_id: 1 },
          { id: 3, blog_id: 1 },
          { id: 4, blog_id: 2 },
          { id: 5, blog_id: 2 },
          { id: 6, blog_id: 3 },
          { id: 7, blog_id: 3 },
        ]);
        await db.public.Comment.createAll([
          { id: 1, popularity: 10, postId: 1 },
          { id: 2, popularity: 50, postId: 2 },
          { id: 3, popularity: 100, postId: 3 },
          { id: 4, popularity: 1000, postId: 4 },
          { id: 5, popularity: 1000, postId: 5 },
        ]);
        const query = db.public.Blog.orderBy((blog) => blog.name.asc()).select('name');
        expect(
          await query
            .where((b) => b.posts.some((p) => p.comment.some((c) => c.popularity.lt(1000))))
            .all(),
        ).toEqual([{ name: 'blog1' }]);
        expect(
          await query
            .where((b) => b.posts.some((p) => p.comment.none((c) => c.popularity.gt(100))))
            .all(),
        ).toEqual([{ name: 'blog1' }, { name: 'blog3' }]);
        expect(
          await query
            .where((b) => b.posts.none((p) => p.comment.some((c) => c.popularity.lt(1000))))
            .all(),
        ).toEqual([{ name: 'blog2' }, { name: 'blog3' }, { name: 'blog4' }]);
        expect(
          await query
            .where((b) => b.posts.none((p) => p.comment.none((c) => c.popularity.gt(100))))
            .all(),
        ).toEqual([{ name: 'blog2' }, { name: 'blog4' }]);
        expect(
          await query
            .where((b) => b.posts.every((p) => p.comment.some((c) => c.popularity.gte(1000))))
            .all(),
        ).toEqual([{ name: 'blog2' }, { name: 'blog4' }]);
        expect(
          await query
            .where((b) => b.posts.every((p) => p.comment.none((c) => c.popularity.gte(1000))))
            .all(),
        ).toEqual([{ name: 'blog1' }, { name: 'blog3' }, { name: 'blog4' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'prisma_25103',
    () =>
      withPostgresPort<Contract25103>({ contractJson: contract25103Json }, async ({ db }) => {
        await db.public.Audience.createAll([
          { id: 'audience1', deletedAt: null },
          { id: 'audience2', deletedAt: null },
        ]);
        await db.public.Contact.create({ id: 'contact1' });
        await db.public.Identity.create({ id: 'identity1', contactId: 'contact1' });
        await db.public.Subscription.createAll([
          {
            id: 'subscription1',
            identityId: 'identity1',
            audienceId: 'audience1',
            optedOutAt: null,
          },
          {
            id: 'subscription2',
            identityId: 'identity1',
            audienceId: 'audience2',
            optedOutAt: null,
          },
        ]);
        const result = await db.public.Contact.orderBy((c) => c.id.asc())
          .select('id')
          .include('identities', (identities) =>
            identities
              .orderBy((i) => i.id.asc())
              .select('id')
              .include('subscriptions', (subscriptions) =>
                subscriptions
                  .where((s) =>
                    and(
                      s.optedOutAt.isNull(),
                      s.audience.some((a) => a.deletedAt.isNull()),
                    ),
                  )
                  .orderBy((s) => s.id.asc())
                  .select('id', 'identityId')
                  .include('audience', (audience) => audience.select('id', 'deletedAt')),
              ),
          )
          .all();
        expect(result).toEqual([
          {
            id: 'contact1',
            identities: [
              {
                id: 'identity1',
                subscriptions: [
                  {
                    id: 'subscription1',
                    identityId: 'identity1',
                    audience: { id: 'audience1', deletedAt: null },
                  },
                  {
                    id: 'subscription2',
                    identityId: 'identity1',
                    audience: { id: 'audience2', deletedAt: null },
                  },
                ],
              },
            ],
          },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'prisma_25104',
    () =>
      withPostgresPort<Contract25104>({ contractJson: contract25104Json }, async ({ db }) => {
        const result = await db.public.A.select('id')
          .include('bs', (bs) => bs.where((b) => b.cs.every((c) => c.name.eq('a'))).select('id'))
          .all();
        expect(result).toEqual([]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'prisma_23742',
    () =>
      withPostgresPort<Contract23742>({ contractJson: contract23742Json }, async ({ db }) => {
        await db.public.Middle.create({ id: 1 });
        await db.public.Top.createAll([
          { id: 1, middleId: 1 },
          { id: 2, middleId: null },
        ]);
        await db.public.Bottom.create({ id: 1, middleId: 1 });
        await db.public.TopBottom.create({ topId: 2, bottomId: 1 });
        const result = await db.public.Top.where({ id: 1 })
          .select('id')
          .include('middle', (middle) =>
            middle
              .select('id')
              .include('bottoms', (bottoms) =>
                bottoms.where((b) => b.tops.some((t) => t.id.eq(2))).select('id'),
              ),
          )
          .first();
        expect(result).toEqual({ id: 1, middle: { id: 1, bottoms: [{ id: 1 }] } });
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'nested_some_filter_m2m_different_pk',
    () =>
      withPostgresPort<DifferentPkContract>(
        { contractJson: differentPkContractJson },
        async ({ db }) => {
          await db.public.Middle.create({ middleId: 1 });
          await db.public.Top.createAll([
            { topId: 1, relatedMiddleId: 1 },
            { topId: 2, relatedMiddleId: null },
          ]);
          await db.public.Bottom.create({ bottomId: 1, relatedMiddleId: 1 });
          await db.public.TopBottom.create({ topId: 2, bottomId: 1 });
          const result = await db.public.Top.where({ topId: 1 })
            .select('topId')
            .include('middle', (middle) =>
              middle
                .select('middleId')
                .include('bottoms', (bottoms) =>
                  bottoms.where((b) => b.tops.some((t) => t.topId.eq(2))).select('bottomId'),
                ),
            )
            .first();
          expect(result).toEqual({ topId: 1, middle: { middleId: 1, bottoms: [{ bottomId: 1 }] } });
        },
      ),
    timeouts.spinUpPpgDev,
  );
});
