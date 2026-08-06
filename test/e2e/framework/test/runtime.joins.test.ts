import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import type { Contract } from './fixtures/generated/contract.d';
import { withTestRuntime } from './utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contractJsonPath = resolve(__dirname, 'fixtures/generated/contract.json');

describe('end-to-end JOIN queries', () => {
  it(
    'INNER JOIN returns matching rows',
    async () => {
      await withTestRuntime<Contract>(contractJsonPath, async ({ db, client, runtime }) => {
        await client.query('insert into "user" (email) values ($1), ($2), ($3)', [
          'ada@example.com',
          'tess@example.com',
          'mike@example.com',
        ]);
        await client.query(
          'insert into "post" ("userId", title, published) values ($1, $2, $3), ($1, $4, $5), ($6, $7, $8)',
          [1, 'First Post', true, 'Second Post', false, 2, 'Third Post', true],
        );

        const rows = await runtime.query(
          db.public.user
            .innerJoin(db.public.post, (f, fns) => fns.eq(f.user.id, f.post.userId))
            .select((f) => ({
              userId: f.user.id,
              email: f.user.email,
              postId: f.post.id,
              title: f.post.title,
            }))
            .build(),
        );

        expect(rows.length).toBe(3);
        expect(rows[0]).toMatchObject({
          userId: expect.any(Number),
          email: expect.any(String),
          postId: expect.any(Number),
          title: expect.any(String),
        });
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'LEFT JOIN returns all users including those without posts',
    async () => {
      await withTestRuntime<Contract>(contractJsonPath, async ({ db, client, runtime }) => {
        await client.query('insert into "user" (email) values ($1), ($2), ($3)', [
          'ada@example.com',
          'tess@example.com',
          'mike@example.com',
        ]);
        await client.query('insert into "post" ("userId", title, published) values ($1, $2, $3)', [
          1,
          'First Post',
          true,
        ]);

        const rows = await runtime.query(
          db.public.user
            .outerLeftJoin(db.public.post, (f, fns) => fns.eq(f.user.id, f.post.userId))
            .select((f) => ({
              userId: f.user.id,
              email: f.user.email,
              postId: f.post.id,
              title: f.post.title,
            }))
            .build(),
        );

        expect(rows.length).toBe(3);
        const adaRow = rows.find((r) => r.email === 'ada@example.com');
        const tessRow = rows.find((r) => r.email === 'tess@example.com');
        const mikeRow = rows.find((r) => r.email === 'mike@example.com');

        expect(adaRow).toMatchObject({
          email: 'ada@example.com',
          postId: expect.anything(),
          title: expect.anything(),
        });

        expect(tessRow).toMatchObject({
          email: 'tess@example.com',
          postId: null,
          title: null,
        });

        expect(mikeRow).toMatchObject({
          email: 'mike@example.com',
          postId: null,
          title: null,
        });
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'RIGHT JOIN returns all posts including those without users',
    async () => {
      await withTestRuntime<Contract>(contractJsonPath, async ({ db, client, runtime }) => {
        await client.query('insert into "user" (email) values ($1)', ['ada@example.com']);
        await client.query(
          'insert into "post" ("userId", title, published) values ($1, $2, $3), ($4, $5, $6)',
          [1, 'First Post', true, 999, 'Orphan Post', true],
        );

        const rows = await runtime.query(
          db.public.user
            .outerRightJoin(db.public.post, (f, fns) => fns.eq(f.user.id, f.post.userId))
            .select((f) => ({
              userId: f.user.id,
              email: f.user.email,
              postId: f.post.id,
              title: f.post.title,
            }))
            .build(),
        );

        expect(rows.length).toBe(2);
        const firstPostRow = rows.find((r) => r.title === 'First Post');
        const orphanPostRow = rows.find((r) => r.title === 'Orphan Post');

        expect(firstPostRow).toMatchObject({
          title: 'First Post',
          userId: expect.anything(),
          email: expect.anything(),
        });

        expect(orphanPostRow).toMatchObject({
          title: 'Orphan Post',
          userId: null,
          email: null,
        });
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'FULL JOIN returns all users and posts',
    async () => {
      await withTestRuntime<Contract>(contractJsonPath, async ({ db, client, runtime }) => {
        await client.query('insert into "user" (email) values ($1), ($2)', [
          'ada@example.com',
          'tess@example.com',
        ]);
        await client.query(
          'insert into "post" ("userId", title, published) values ($1, $2, $3), ($4, $5, $6)',
          [1, 'First Post', true, 999, 'Orphan Post', true],
        );

        const rows = await runtime.query(
          db.public.user
            .outerFullJoin(db.public.post, (f, fns) => fns.eq(f.user.id, f.post.userId))
            .select((f) => ({
              userId: f.user.id,
              email: f.user.email,
              postId: f.post.id,
              title: f.post.title,
            }))
            .build(),
        );

        expect(rows.length).toBe(3);
        const adaRow = rows.find((r) => r.email === 'ada@example.com');
        const tessRow = rows.find((r) => r.email === 'tess@example.com');
        const orphanRow = rows.find((r) => r.title === 'Orphan Post');

        expect(adaRow).toMatchObject({
          email: 'ada@example.com',
          postId: expect.anything(),
        });

        expect(tessRow).toMatchObject({
          email: 'tess@example.com',
          postId: null,
        });

        expect(orphanRow).toMatchObject({
          title: 'Orphan Post',
          userId: null,
          email: null,
        });
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'chained joins (user -> post -> comment) returns correct results',
    async () => {
      await withTestRuntime<Contract>(contractJsonPath, async ({ db, client, runtime }) => {
        await client.query('insert into "user" (email) values ($1), ($2)', [
          'ada@example.com',
          'tess@example.com',
        ]);
        await client.query(
          'insert into "post" ("userId", title, published) values ($1, $2, $3), ($1, $4, $5)',
          [1, 'First Post', true, 'Second Post', false],
        );
        await client.query('insert into "comment" ("postId", content) values ($1, $2), ($1, $3)', [
          1,
          'First Comment',
          'Second Comment',
        ]);

        const rows = await runtime.query(
          db.public.user
            .innerJoin(db.public.post, (f, fns) => fns.eq(f.user.id, f.post.userId))
            .outerLeftJoin(db.public.comment, (f, fns) => fns.eq(f.post.id, f.comment.postId))
            .select((f) => ({
              userId: f.user.id,
              email: f.user.email,
              postId: f.post.id,
              title: f.post.title,
              commentId: f.comment.id,
              content: f.comment.content,
            }))
            .build(),
        );

        expect(rows.length).toBe(3);
        const firstPostRow = rows.find((r) => r.title === 'First Post' && r.commentId !== null);
        const secondPostRow = rows.find((r) => r.title === 'Second Post');

        expect(firstPostRow).toMatchObject({
          title: 'First Post',
          commentId: expect.anything(),
          content: expect.anything(),
        });

        expect(secondPostRow).toMatchObject({
          title: 'Second Post',
          commentId: null,
          content: null,
        });
      });
    },
    timeouts.spinUpPpgDev,
  );
});
