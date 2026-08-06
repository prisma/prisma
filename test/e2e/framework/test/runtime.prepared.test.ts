import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withTransaction } from '@prisma/orm-postgres/family-runtime';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import type { Contract } from './fixtures/generated/contract.d';
import { withTestRuntime } from './utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contractJsonPath = resolve(__dirname, 'fixtures/generated/contract.json');

describe('end-to-end prepared statements (Postgres)', () => {
  it(
    'lowers once and reuses across multiple .execute(params) calls',
    async () => {
      await withTestRuntime<Contract>(contractJsonPath, async ({ db, client, runtime }) => {
        await client.query('insert into "user" (email) values ($1), ($2), ($3) returning id', [
          'ada@example.com',
          'tess@example.com',
          'mike@example.com',
        ]);

        const ps = await runtime.prepare({ email: 'sql/varchar@1' }, (params) =>
          db.public.user
            .select('id', 'email')
            .where((f, fns) => fns.eq(f.email, params.email))
            .limit(1)
            .build(),
        );

        const ada = await runtime.queryPrepared(ps, { email: 'ada@example.com' });
        const tess = await runtime.queryPrepared(ps, { email: 'tess@example.com' });
        const missing = await runtime.queryPrepared(ps, { email: 'absent@example.com' });

        expect(ada).toHaveLength(1);
        expect(ada[0]).toMatchObject({ email: 'ada@example.com', id: expect.any(Number) });
        expect(tess).toHaveLength(1);
        expect(tess[0]).toMatchObject({ email: 'tess@example.com', id: expect.any(Number) });
        expect(missing).toHaveLength(0);
        expect(ada[0]!.id).not.toBe(tess[0]!.id);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'a single PreparedStatement runs against both runtime and transaction targets',
    async () => {
      await withTestRuntime<Contract>(contractJsonPath, async ({ db, runtime }) => {
        const ps = await runtime.prepare({ email: 'sql/varchar@1' }, (params) =>
          db.public.user
            .select('id', 'email')
            .where((f, fns) => fns.eq(f.email, params.email))
            .limit(1)
            .build(),
        );

        const insertedId = await withTransaction(runtime, async (tx) => {
          await tx.execute(db.public.user.insert([{ email: 'tx-prepared@example.com' }]).build());
          const rows = await tx.queryPrepared(ps, { email: 'tx-prepared@example.com' });
          expect(rows).toHaveLength(1);
          return rows[0]!.id;
        });

        const committed = await runtime.queryPrepared(ps, { email: 'tx-prepared@example.com' });
        expect(committed).toHaveLength(1);
        expect(committed[0]!.id).toBe(insertedId);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'binds prepared params into LIMIT and OFFSET',
    async () => {
      await withTestRuntime<Contract>(contractJsonPath, async ({ db, client, runtime }) => {
        await client.query('insert into "user" (email) values ($1), ($2), ($3), ($4)', [
          'a@example.com',
          'b@example.com',
          'c@example.com',
          'd@example.com',
        ]);

        const ps = await runtime.prepare({ take: 'pg/int4@1', skip: 'pg/int4@1' }, (params) =>
          db.public.user
            .select('id', 'email')
            .orderBy('id')
            .limit(params.take)
            .offset(params.skip)
            .build(),
        );

        const page1 = await runtime.queryPrepared(ps, { take: 2, skip: 0 });
        const page2 = await runtime.queryPrepared(ps, { take: 2, skip: 2 });

        expect(page1).toHaveLength(2);
        expect(page2).toHaveLength(2);
        expect(page1.map((r) => r.email)).toEqual(['a@example.com', 'b@example.com']);
        expect(page2.map((r) => r.email)).toEqual(['c@example.com', 'd@example.com']);

        const wide = await runtime.queryPrepared(ps, { take: 10, skip: 0 });
        expect(wide).toHaveLength(4);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'rejects an unused declared param at prepare time',
    async () => {
      await withTestRuntime<Contract>(contractJsonPath, async ({ db, runtime }) => {
        await expect(
          runtime.prepare({ email: 'sql/varchar@1', unused: 'pg/int4@1' }, (params) =>
            db.public.user
              .select('id', 'email')
              .where((f, fns) => fns.eq(f.email, params.email))
              .limit(1)
              .build(),
          ),
        ).rejects.toMatchObject({
          code: 'RUNTIME.PREPARE_UNUSED_PARAM',
          details: { unused: ['unused'] },
        });
      });
    },
    timeouts.spinUpPpgDev,
  );
});
