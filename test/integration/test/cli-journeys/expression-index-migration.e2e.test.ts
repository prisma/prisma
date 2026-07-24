/**
 * Expression / partial / unique index migration journey (a stand-in for the
 * Cipherstash encrypted-search case: the PSL/TS authoring surfaces are not
 * built yet, so the contract is authored through the factory layer — the
 * only surface that can express these indexes today).
 *
 * A contract carrying an expression index, a partial index, and a unique
 * expression index is planned onto a fresh database (`migration plan`, DDL
 * byte-asserted), applied, and verifies clean. Dropping one of the indexes
 * out-of-band fails `db verify` naming it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withClient } from '@prisma-next/test-utils';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  getLatestMigrationDir,
  type JourneyContext,
  runContractEmit,
  runDbVerify,
  runMigrate,
  runMigrationPlanAndEmit,
  setupJourney,
  swapContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

interface PlannedOp {
  readonly id: string;
  readonly execute: readonly { readonly description: string; readonly sql: string }[];
}

withTempDir(({ createTempDir }) => {
  describe('expression/partial/unique index migration', () => {
    const db = useDevDatabase();

    it(
      'plan renders the DDL byte-exactly → apply → verify clean → out-of-band drop fails verify',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });
        swapContract(ctx, 'contract-expression-indexes');

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, `X.01: contract emit\n${stripAnsi(emit.stderr)}`).toBe(0);

        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'initial']);
        expect(plan.exitCode, `X.02: migration plan\n${stripAnsi(plan.stderr)}`).toBe(0);
        const dir = getLatestMigrationDir(ctx);
        expect(dir, 'X.02: planned migration dir').toBeDefined();
        const ops: readonly PlannedOp[] = JSON.parse(
          readFileSync(join(ctx.testDir, 'migrations/app', dir ?? '', 'ops.json'), 'utf-8'),
        );
        const indexSql = ops
          .filter((op) => op.id.startsWith('index.'))
          .map((op) => op.execute[0]?.sql);
        expect(indexSql, 'X.02: byte-exact index DDL').toEqual([
          'CREATE INDEX "doc_email_active_idx" ON "public"."doc" ("email") WHERE ((deleted_at IS NULL))',
          'CREATE UNIQUE INDEX "doc_email_eq_key" ON "public"."doc" (lower(email))',
          'CREATE INDEX "doc_email_lower_idx" ON "public"."doc" (lower(email))',
        ]);

        const apply = await runMigrate(ctx);
        expect(apply.exitCode, `X.03: migration apply\n${stripAnsi(apply.stderr)}`).toBe(0);

        const verify = await runDbVerify(ctx);
        expect(verify.exitCode, `X.04: db verify clean\n${stripAnsi(verify.stderr)}`).toBe(0);

        // X.05: out-of-band drop fails verify, naming the index.
        await withClient(db.connectionString, (client) =>
          client.query('DROP INDEX "public"."doc_email_lower_idx"'),
        );
        const verifyFail = await runDbVerify(ctx, ['--schema-only']);
        expect(verifyFail.exitCode, 'X.05: verify fails after drop').toBe(1);
        expect(
          stripAnsi(verifyFail.stderr) + stripAnsi(verifyFail.stdout),
          'X.05: names it',
        ).toContain('doc_email_lower_idx');
      },
      timeouts.spinUpPpgDev,
    );
  });
});
