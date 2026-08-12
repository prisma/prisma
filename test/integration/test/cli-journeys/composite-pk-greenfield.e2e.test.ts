/**
 * Composite Primary Key Greenfield
 *
 * A developer authors a PSL contract with a junction table, initializes a
 * fresh database, verifies the live primary-key shape, and round-trips the
 * schema back through contract infer.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  runContractEmit,
  runContractInfer,
  runDbInit,
  runDbVerify,
  setupJourney,
  sql,
  swapPslContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

withTempDir(({ createTempDir }) => {
  describe('Composite Primary Key Greenfield', () => {
    const db = useDevDatabase();

    it(
      'psl emit → init → live primary-key enforcement → infer round-trip',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
          contractMode: 'psl',
        });

        swapPslContract(ctx, 'contract-composite-pk');

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, `contract emit\n${stripAnsi(emit.stderr)}`).toBe(0);

        const dryRun = await runDbInit(ctx, ['--dry-run']);
        expect(dryRun.exitCode, 'db init --dry-run').toBe(0);
        expect(stripAnsi(dryRun.stdout), 'dry-run planned work').toContain('Planned');
        expect(stripAnsi(dryRun.stdout), 'dry-run output').toContain('dry run');

        const tablesAfterDryRun = await sql(
          db.connectionString,
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'membership'`,
        );
        expect(tablesAfterDryRun.rows, 'dry-run does not create membership').toHaveLength(0);

        const init = await runDbInit(ctx);
        expect(init.exitCode, `db init\n${stripAnsi(init.stderr)}`).toBe(0);
        expect(stripAnsi(init.stdout), 'init applied work').toContain('Applied');

        const tablesAfterInit = await sql(
          db.connectionString,
          `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'membership'`,
        );
        expect(tablesAfterInit.rows, 'membership table created').toHaveLength(1);

        const primaryKeyColumns = await sql(
          db.connectionString,
          `SELECT c.conname, a.attname
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
           JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ordinality) ON true
           JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
           WHERE n.nspname = 'public'
             AND t.relname = 'membership'
             AND c.contype = 'p'
           ORDER BY k.ordinality`,
        );
        expect(primaryKeyColumns.rows, 'membership primary key columns').toEqual([
          { conname: 'membership_pkey', attname: 'org_id' },
          { conname: 'membership_pkey', attname: 'user_id' },
        ]);

        await sql(db.connectionString, `INSERT INTO "org" (id, name) VALUES (1, 'Prisma')`);
        await sql(
          db.connectionString,
          `INSERT INTO "user" (id, email) VALUES (1, 'dev@example.test')`,
        );
        await sql(
          db.connectionString,
          `INSERT INTO "membership" (org_id, user_id, role) VALUES (1, 1, 'owner')`,
        );

        await expect(
          sql(
            db.connectionString,
            `INSERT INTO "membership" (org_id, user_id, role) VALUES (1, 1, 'viewer')`,
          ),
          'duplicate membership fails on primary key',
        ).rejects.toThrow(/membership_pkey/);

        const membershipCount = await sql(
          db.connectionString,
          `SELECT count(*)::int AS count FROM "membership"`,
        );
        expect(Number(membershipCount.rows[0]?.['count']), 'one membership row remains').toBe(1);

        const schemaVerify = await runDbVerify(ctx, ['--schema-only']);
        expect(
          schemaVerify.exitCode,
          `db verify --schema-only\n${stripAnsi(schemaVerify.stderr)}`,
        ).toBe(0);

        const strictVerify = await runDbVerify(ctx, ['--strict']);
        expect(strictVerify.exitCode, `db verify --strict\n${stripAnsi(strictVerify.stderr)}`).toBe(
          0,
        );

        const infer = await runContractInfer(ctx);
        expect(infer.exitCode, `contract infer\n${stripAnsi(infer.stderr)}`).toBe(0);
        const inferredPsl = readFileSync(join(ctx.testDir, 'contract.prisma'), 'utf-8');
        expect(inferredPsl, 'inferred PSL keeps composite id').toContain(
          '@@id([orgId, userId], map: "membership_pkey")',
        );

        const emitAfterInfer = await runContractEmit(ctx);
        expect(
          emitAfterInfer.exitCode,
          `contract emit after infer\n${stripAnsi(emitAfterInfer.stderr)}`,
        ).toBe(0);

        const schemaVerifyAfterInfer = await runDbVerify(ctx, ['--schema-only']);
        expect(
          schemaVerifyAfterInfer.exitCode,
          `db verify --schema-only after infer\n${stripAnsi(schemaVerifyAfterInfer.stderr)}`,
        ).toBe(0);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
