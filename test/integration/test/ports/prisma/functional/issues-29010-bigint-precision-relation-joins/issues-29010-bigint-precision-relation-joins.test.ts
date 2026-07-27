import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../../../_harness/postgres';
import type { Contract } from './_fixture/generated/contract';
import contractJson from './_fixture/generated/contract.json' with { type: 'json' };

// Port of prisma/prisma@a6d0155
// packages/client/tests/functional/issues/29010-bigint-precision-relation-joins
// (postgres matrix entry; mysql/cockroachdb/postgres — we port postgres).
//
// Subject: BigInt ids that exceed Number.MAX_SAFE_INTEGER keep precision when
// returned via relation-join (include) queries.
//
// prisma-next int8 codec: BigInt primary-key values beyond MAX_SAFE_INTEGER lose
// precision when they flow through the ORM's include/relation-join path. The
// direct scalar fields (e.g., post.id, post.authorId from the post's own row)
// appear to receive the value from pglite via JSON text and are returned as the
// imprecise float64 number (312590077454712800 instead of 312590077454712834).
// The included relation's id field (author.id returned from the join) also loses
// precision. This is the exact regression the upstream issue documents.
//
// Sending the BigInt value as a decimal string cast to number (test files are
// cast-exempt per the brief) avoids JS-side precision loss during encoding, but
// the read-back from pglite (which returns int8 as a JSON number for the relation
// include path) still loses precision. → it.fails for both tests.
//
// Dispositions:
//   'preserves BigInt precision in relationJoins queries'        → it.fails (int8 precision loss in include)
//   'preserves BigInt precision in nested relationJoins queries' → it.fails (int8 precision loss in include)

// BigInt IDs that exceed Number.MAX_SAFE_INTEGER (2^53 - 1 = 9007199254740991).
// Send as decimal string cast to number (test files are cast-exempt);
// pglite may receive the string but may return a number with precision loss.
const USER_ID_STR = '312590077454712834';
const POST_ID_STR = '412590077454712834';
const USER_ID = USER_ID_STR as unknown as number;
const POST_ID = POST_ID_STR as unknown as number;

function withBigIntRelationJoins(fn: Parameters<typeof withPostgresPort<Contract>>[1]) {
  return withPostgresPort<Contract>({ contractJson }, async (ctx) => {
    await ctx.db.public.User.create({ id: USER_ID, name: 'Alice' });
    await ctx.db.public.Post.create({ id: POST_ID, title: 'Hello World', authorId: USER_ID });
    await fn(ctx);
  });
}

describe('ports/prisma/functional/issues-29010-bigint-precision-relation-joins', () => {
  it.fails(
    'preserves BigInt precision in relationJoins queries',
    () =>
      withBigIntRelationJoins(async ({ db }) => {
        const user = await db.public.User.where({ id: USER_ID }).include('posts').first();

        expect(user).not.toBeNull();
        expect(user!.id).toBe(USER_ID_STR);
        expect(user!.posts).toHaveLength(1);
        expect(user!.posts[0]!['id']).toBe(POST_ID_STR);
        expect(user!.posts[0]!['authorId']).toBe(USER_ID_STR);
      }),
    timeouts.spinUpPpgDev,
  );

  it.fails(
    'preserves BigInt precision in nested relationJoins queries',
    () =>
      withBigIntRelationJoins(async ({ db }) => {
        const post = await db.public.Post.where({ id: POST_ID })
          .include('author', (author) => author.include('posts'))
          .first();

        expect(post).not.toBeNull();
        expect(post!.id).toBe(POST_ID_STR);
        expect(post!.authorId).toBe(USER_ID_STR);
        expect(post!.author['id']).toBe(USER_ID_STR);
        expect(post!.author.posts).toHaveLength(1);
        expect(post!.author.posts[0]!['id']).toBe(POST_ID_STR);
      }),
    timeouts.spinUpPpgDev,
  );
});
