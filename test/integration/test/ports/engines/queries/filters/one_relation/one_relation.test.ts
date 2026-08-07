import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../../_harness/postgres';
import type { Contract as Contract21356 } from './_fixture/21356/generated/contract';
import contract21356Json from './_fixture/21356/generated/contract.json' with { type: 'json' };
import type { Contract as Contract21366 } from './_fixture/21366/generated/contract';
import contract21366Json from './_fixture/21366/generated/contract.json' with { type: 'json' };
import type { Contract as CommonContract } from './_fixture/common/generated/contract';
import commonContractJson from './_fixture/common/generated/contract.json' with { type: 'json' };

async function seedCommon(
  db: Parameters<Parameters<typeof withPostgresPort<CommonContract>>[1]>[0]['db'],
) {
  await db.public.Blog.createAll([
    { blogId: 'blog-1', name: 'blog 1' },
    { blogId: 'blog-2', name: 'blog 2' },
    { blogId: 'blog-3', name: 'blog 3' },
  ]);
  await db.public.Post.createAll([
    { postId: 'post-1', title: 'post 1', popularity: 10, blogId: 'blog-1' },
    { postId: 'post-2', title: 'post 2', popularity: 100, blogId: 'blog-2' },
    { postId: 'post-3', title: 'post 3', popularity: 1000, blogId: 'blog-3' },
  ]);
  await db.public.Comment.createAll([
    { commentId: 'comment-1', text: 'comment 1', likes: 10, postId: 'post-1' },
    { commentId: 'comment-2', text: 'comment 2', likes: 100, postId: 'post-2' },
    { commentId: 'comment-3', text: 'comment 3', likes: 1000, postId: 'post-3' },
  ]);
}

function withCommon(fn: Parameters<typeof withPostgresPort<CommonContract>>[1]) {
  return withPostgresPort<CommonContract>({ contractJson: commonContractJson }, async (ctx) => {
    await seedCommon(ctx.db);
    await fn(ctx);
  });
}

describe('ports/engines/queries/filters/one_relation', () => {
  it(
    'basic_scalar',
    () =>
      withCommon(async ({ db }) => {
        const result = await db.public.Post.where((post) => post.title.eq('post 2'))
          .select('title')
          .all();
        expect(result).toEqual([{ title: 'post 2' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l1_one_rel',
    () =>
      withCommon(async ({ db }) => {
        await db.public.Blog.create({ blogId: 'blog-4', name: 'blog 4' });
        expect(
          await db.public.Post.where((p) => p.title.eq('post 2'))
            .select('title')
            .all(),
        ).toEqual([{ title: 'post 2' }]);
        expect(
          await db.public.Post.where((p) => p.blog.some((b) => b.name.eq('blog 1')))
            .select('title')
            .all(),
        ).toEqual([{ title: 'post 1' }]);
        expect(
          await db.public.Blog.where((b) => b.post.some((p) => p.popularity.gte(100)))
            .select('name')
            .all(),
        ).toEqual([{ name: 'blog 2' }, { name: 'blog 3' }]);
        expect(
          await db.public.Blog.where((b) => b.post.some((p) => p.popularity.gte(500)))
            .select('name')
            .all(),
        ).toEqual([{ name: 'blog 3' }]);
        expect(
          await db.public.Blog.where((b) => b.post.none((p) => p.popularity.gte(500)))
            .orderBy((b) => b.blogId.asc())
            .select('name')
            .all(),
        ).toEqual([{ name: 'blog 1' }, { name: 'blog 2' }, { name: 'blog 4' }]);
        await db.public.Post.create({
          postId: 'post-4',
          title: 'Post 4',
          popularity: 5,
          blogId: null,
        });
        expect(
          await db.public.Post.where((p) => p.blog.none())
            .select('title')
            .all(),
        ).toEqual([{ title: 'Post 4' }]);
        expect(
          await db.public.Post.where((p) => p.blog.some())
            .orderBy((p) => p.postId.asc())
            .select('title')
            .all(),
        ).toEqual([{ title: 'post 1' }, { title: 'post 2' }, { title: 'post 3' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l1_one_rel_shorthands',
    () =>
      withCommon(async ({ db }) => {
        expect(
          await db.public.Post.where((p) => p.title.eq('post 2'))
            .select('title')
            .all(),
        ).toEqual([{ title: 'post 2' }]);
        expect(
          await db.public.Post.where((p) => p.blog.some((b) => b.name.eq('blog 1')))
            .select('title')
            .all(),
        ).toEqual([{ title: 'post 1' }]);
        expect(
          await db.public.Blog.where((b) => b.post.some((p) => p.popularity.gte(100)))
            .select('name')
            .all(),
        ).toEqual([{ name: 'blog 2' }, { name: 'blog 3' }]);
        expect(
          await db.public.Blog.where((b) => b.post.some((p) => p.popularity.gte(500)))
            .select('name')
            .all(),
        ).toEqual([{ name: 'blog 3' }]);
        expect(
          await db.public.Post.where((p) => p.blog.some((b) => b.name.eq('blog 1')))
            .select('title')
            .all(),
        ).toEqual([{ title: 'post 1' }]);
        await db.public.Post.create({
          postId: 'post-4',
          title: 'Post 4',
          popularity: 5,
          blogId: null,
        });
        expect(
          await db.public.Post.where((p) => p.blog.none())
            .select('title')
            .all(),
        ).toEqual([{ title: 'Post 4' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'l2_one_rel',
    () =>
      withCommon(async ({ db }) => {
        expect(
          await db.public.Post.where((p) => p.title.eq('post 2'))
            .select('title')
            .all(),
        ).toEqual([{ title: 'post 2' }]);
        expect(
          await db.public.Blog.where((b) =>
            b.post.some((p) => p.comment.some((c) => c.likes.eq(10))),
          )
            .select('name')
            .all(),
        ).toEqual([{ name: 'blog 1' }]);
        expect(
          await db.public.Blog.where((b) =>
            b.post.some((p) => p.comment.some((c) => c.likes.eq(1000))),
          )
            .select('name')
            .all(),
        ).toEqual([{ name: 'blog 3' }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'nested_to_one_filter',
    () =>
      withCommon(async ({ db }) => {
        const unmatched = await db.public.Blog.orderBy((b) => b.blogId.asc())
          .select('name')
          .include('post', (post) => post.where((p) => p.title.eq('post1')).select('title'))
          .all();
        expect(unmatched).toEqual([
          { name: 'blog 1', post: null },
          { name: 'blog 2', post: null },
          { name: 'blog 3', post: null },
        ]);
        const matchedWithComment = await db.public.Blog.orderBy((b) => b.blogId.asc())
          .select('name')
          .include('post', (post) =>
            post
              .where((p) => p.title.eq('post 1'))
              .where((p) => p.comment.some((c) => c.text.eq('comment 1')))
              .select('title')
              .include('comment', (comment) => comment.select('text')),
          )
          .all();
        expect(matchedWithComment).toEqual([
          { name: 'blog 1', post: { title: 'post 1', comment: { text: 'comment 1' } } },
          { name: 'blog 2', post: null },
          { name: 'blog 3', post: null },
        ]);
        const matched = await db.public.Blog.orderBy((b) => b.blogId.asc())
          .select('name')
          .include('post', (post) =>
            post
              .where((p) => p.title.eq('post 1'))
              .where((p) => p.comment.some((c) => c.text.eq('comment 1')))
              .select('title'),
          )
          .all();
        expect(matched).toEqual([
          { name: 'blog 1', post: { title: 'post 1' } },
          { name: 'blog 2', post: null },
          { name: 'blog 3', post: null },
        ]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'repro_21356',
    () =>
      withPostgresPort<Contract21356>({ contractJson: contract21356Json }, async ({ db }) => {
        await db.public.User.create({ id: 1, name: 'Bob', userId: 1, userId2: 1 });
        await db.public.Post.create({ id: 1, title: 'Hello', userId: 1, userId_2: 1 });
        const result = await db.public.User.where((u) =>
          u.posts.some((p) => p.author.some((author) => author.name.eq('Bob'))),
        )
          .select('id')
          .all();
        expect(result).toEqual([{ id: 1 }]);
      }),
    timeouts.spinUpPpgDev,
  );

  it(
    'repro_21366',
    () =>
      withPostgresPort<Contract21366>({ contractJson: contract21366Json }, async ({ db }) => {
        await db.public.device_state.create({ id: 1, device_id: '1' });
        await db.public.device.create({ id: 1, device_id: '1' });
        const result = await db.public.device_state
          .where((state) => state.device.some((device) => device.device_id.eq('1')))
          .select('id')
          .all();
        expect(result).toEqual([{ id: 1 }]);
      }),
    timeouts.spinUpPpgDev,
  );
});
