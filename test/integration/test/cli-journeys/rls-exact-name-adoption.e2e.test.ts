/**
 * Scenario C, policy edition: a live policy with a human-readable exact name
 * is adopted via `@@map` (body text = the live reprint), verifies clean, and
 * replacing `@@map` with the plain managed head converges through EXACTLY
 * one `ALTER POLICY … RENAME` (phase-2 content pairing) — no drop, no
 * create — after which verify is clean under the wire name.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSqlBody } from '@prisma-next/sql-schema-ir/naming';
import { computeContentHash } from '@prisma-next/target-postgres/rls-canonicalize';
import { withClient } from '@prisma-next/test-utils';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  getLatestMigrationDir,
  type JourneyContext,
  parseJsonOutput,
  runContractEmit,
  runDbSign,
  runDbVerify,
  runMigrate,
  runMigrationPlanAndEmit,
  setupJourney,
  swapPslContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

const EXACT_NAME = 'Tenant members can read';
const ADOPTED_SCHEMA = `
  CREATE ROLE app_user;
  CREATE TABLE "user" (
    id int4 PRIMARY KEY,
    tenant_id int4 NOT NULL
  );
  ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "${EXACT_NAME}" ON "user"
    AS PERMISSIVE FOR SELECT TO app_user
    USING (tenant_id = 1);
`;

const MANAGED_NAME = `tenant_read_${computeContentHash({
  using: normalizeSqlBody('(tenant_id = 1)'),
  roles: ['app_user'],
  operation: 'select',
  permissive: true,
})}`;

interface PlannedOp {
  readonly id: string;
  readonly operationClass: string;
  readonly execute: readonly { readonly description: string; readonly sql: string }[];
}

function readPlannedOps(ctx: JourneyContext): readonly PlannedOp[] {
  const dir = getLatestMigrationDir(ctx);
  expect(dir, 'planned migration dir exists').toBeDefined();
  return JSON.parse(
    readFileSync(join(ctx.testDir, 'migrations/app', dir ?? '', 'ops.json'), 'utf-8'),
  );
}

withTempDir(({ createTempDir }) => {
  describe('Scenario C: exact-named policy adoption converges to managed via one rename', () => {
    const db = useDevDatabase({
      onReady: (cs) => withClient(cs, (client) => client.query(ADOPTED_SCHEMA)),
    });

    it(
      'adopt via @@map → verify clean → swap to managed head → renames-only plan → apply → verify clean',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
          contractMode: 'psl',
        });

        // C.01: adopt the live policy exactly via @@map; sign; verify clean.
        swapPslContract(ctx, 'contract-rls-adopted');
        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, `C.01: contract emit\n${stripAnsi(emit.stderr)}`).toBe(0);
        const sign = await runDbSign(ctx);
        expect(sign.exitCode, `C.01: db sign\n${stripAnsi(sign.stderr)}`).toBe(0);
        const verifyAdopted = await runDbVerify(ctx);
        expect(
          verifyAdopted.exitCode,
          `C.01: verify clean\n${stripAnsi(verifyAdopted.stderr)}`,
        ).toBe(0);

        // C.02: baseline migration (EMPTY → adopted contract); no-op on apply.
        const planBaseline = await runMigrationPlanAndEmit(ctx, ['--name', 'baseline']);
        expect(
          planBaseline.exitCode,
          `C.02: plan baseline\n${stripAnsi(planBaseline.stderr)}`,
        ).toBe(0);
        const applyBaseline = await runMigrate(ctx, ['--json']);
        expect(
          applyBaseline.exitCode,
          `C.02: apply baseline\n${stripAnsi(applyBaseline.stderr)}`,
        ).toBe(0);
        expect(parseJsonOutput(applyBaseline), 'C.02: baseline no-op').toMatchObject({
          migrationsApplied: 0,
        });

        // C.02b: replace @@map with the plain managed head (body verbatim).
        swapPslContract(ctx, 'contract-rls-managed');
        const emitManaged = await runContractEmit(ctx);
        expect(emitManaged.exitCode, `C.02: emit managed\n${stripAnsi(emitManaged.stderr)}`).toBe(
          0,
        );

        // C.03: the widening plan is exactly one ALTER POLICY … RENAME.
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'adopt-managed-name']);
        expect(plan.exitCode, `C.03: migration plan\n${stripAnsi(plan.stderr)}`).toBe(0);
        const ops = readPlannedOps(ctx);
        expect(
          ops.map((op) => ({
            id: op.id,
            operationClass: op.operationClass,
            sql: op.execute[0]?.sql,
          })),
          'C.03: exactly one rename',
        ).toEqual([
          {
            id: `rlsPolicy.public.user.${EXACT_NAME}.rename`,
            operationClass: 'widening',
            sql: `ALTER POLICY "${EXACT_NAME}" ON "public"."user" RENAME TO "${MANAGED_NAME}"`,
          },
        ]);

        // C.04: apply and verify clean under the wire name.
        const apply = await runMigrate(ctx);
        expect(apply.exitCode, `C.04: migration apply\n${stripAnsi(apply.stderr)}`).toBe(0);
        const verifyManaged = await runDbVerify(ctx);
        expect(
          verifyManaged.exitCode,
          `C.04: verify clean\n${stripAnsi(verifyManaged.stderr)}`,
        ).toBe(0);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
