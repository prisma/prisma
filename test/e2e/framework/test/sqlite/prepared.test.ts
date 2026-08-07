import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNBOUND_NAMESPACE_ID } from '@prisma/orm-sqlite/components/ir';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import type { Contract } from './fixtures/generated/contract.d';
import { withSqliteTestRuntime } from './utils';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractJsonPath = resolve(__dirname, 'fixtures/generated/contract.json');

describe('e2e: prepared statements (SQLite)', { timeout: timeouts.databaseOperation }, () => {
  it('lowers once and reuses across multiple queryPrepared calls', async () => {
    await withSqliteTestRuntime<Contract>(contractJsonPath, async ({ db, runtime }) => {
      const ps = await runtime.prepare({ id: 'sql/int@1' }, (params) =>
        db[UNBOUND_NAMESPACE_ID].users
          .select('id', 'name')
          .where((f, fns) => fns.eq(f.id, params.id))
          .build(),
      );

      const alice = await runtime.queryPrepared(ps, { id: 1 });
      const bob = await runtime.queryPrepared(ps, { id: 2 });
      const missing = await runtime.queryPrepared(ps, { id: 999 });

      expect(alice).toHaveLength(1);
      expect(alice[0]).toMatchObject({ id: 1, name: 'Alice' });
      expect(bob).toHaveLength(1);
      expect(bob[0]).toMatchObject({ id: 2, name: 'Bob' });
      expect(missing).toHaveLength(0);
    });
  });

  it('binds prepared params into LIMIT and OFFSET', async () => {
    await withSqliteTestRuntime<Contract>(contractJsonPath, async ({ db, runtime }) => {
      const ps = await runtime.prepare({ take: 'sql/int@1', skip: 'sql/int@1' }, (params) =>
        db[UNBOUND_NAMESPACE_ID].users
          .select('id', 'name')
          .orderBy('id')
          .limit(params.take)
          .offset(params.skip)
          .build(),
      );

      const page1 = await runtime.queryPrepared(ps, { take: 2, skip: 0 });
      const page2 = await runtime.queryPrepared(ps, { take: 2, skip: 2 });

      expect(page1.map((r) => r.name)).toEqual(['Alice', 'Bob']);
      expect(page2.map((r) => r.name)).toEqual(['Charlie', 'Diana']);

      const wide = await runtime.queryPrepared(ps, { take: 10, skip: 0 });
      expect(wide).toHaveLength(4);
    });
  });

  it('rejects an unused declared param at prepare time', async () => {
    await withSqliteTestRuntime<Contract>(contractJsonPath, async ({ db, runtime }) => {
      await expect(
        runtime.prepare({ id: 'sql/int@1', unused: 'sql/text@1' }, (params) =>
          db[UNBOUND_NAMESPACE_ID].users
            .select('id', 'name')
            .where((f, fns) => fns.eq(f.id, params.id))
            .build(),
        ),
      ).rejects.toMatchObject({
        code: 'RUNTIME.PREPARE_UNUSED_PARAM',
        details: { unused: ['unused'] },
      });
    });
  });
});
