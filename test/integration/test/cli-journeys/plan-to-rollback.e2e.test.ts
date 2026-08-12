/**
 * Plannable rollback edge (TML-2690)
 *
 * Reproduces the failing case end-to-end: from a two-migration applied state,
 * `migration plan --to <dir>^` plans the reverse edge toward the predecessor
 * contract (a DROP, flagged destructive), and `migrate --to <dir>^` then applies
 * it and moves the marker back — all WITHOUT editing the contract source.
 *
 * This is the one-command recovery the `migrate` path-unreachable diagnostic now
 * advertises: previously `migrate --to <dir>^` was advertised in `--help` but
 * dead-ended, forcing a contract-surgery workaround.
 */

import { readFileSync } from 'node:fs';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  getLatestMigrationDir,
  type JourneyContext,
  migrationStatusAppSpace,
  parseJsonOutput,
  parseMigrationStatusJson,
  runContractEmit,
  runMigrate,
  runMigrationPlanAndEmit,
  runMigrationStatus,
  setupJourney,
  swapContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

interface PlanJson {
  readonly from: string;
  readonly to: string;
  readonly operations: ReadonlyArray<{ readonly operationClass: string }>;
}

withTempDir(({ createTempDir }) => {
  describe('migration plan --to <dir>^ enables a one-command rollback (TML-2690)', () => {
    const db = useDevDatabase();

    it(
      'plans and applies a reverse edge with no contract-source edit, moving the marker back',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        // Base (C1): emit → plan + apply init. Marker lands at C1.
        expect((await runContractEmit(ctx)).exitCode, 'emit C1').toBe(0);
        const plan0 = await runMigrationPlanAndEmit(ctx, ['--name', 'init', '--json']);
        expect(plan0.exitCode, 'plan init').toBe(0);
        const c1Hash = parseJsonOutput<PlanJson>(plan0).to;
        expect((await runMigrate(ctx)).exitCode, 'apply init').toBe(0);

        // Add phone (C2): swap source → emit → plan + apply add-phone. Marker at C2.
        swapContract(ctx, 'contract-phone');
        expect((await runContractEmit(ctx)).exitCode, 'emit C2').toBe(0);
        const plan1 = await runMigrationPlanAndEmit(ctx, ['--name', 'add-phone', '--json']);
        expect(plan1.exitCode, 'plan add-phone').toBe(0);
        const c2Hash = parseJsonOutput<PlanJson>(plan1).to;
        expect(c2Hash, 'C2 differs from C1').not.toBe(c1Hash);
        const addPhoneDir = getLatestMigrationDir(ctx);
        expect(addPhoneDir, 'captured add-phone dir').toBeTruthy();
        expect((await runMigrate(ctx)).exitCode, 'apply add-phone').toBe(0);

        // Rollback WITHOUT touching the contract source: plan toward the
        // add-phone migration's predecessor (`<dir>^` == C1). The emitted
        // contract.ts still holds the phone variant throughout.
        const rollbackTarget = `${addPhoneDir}^`;
        const planRollback = await runMigrationPlanAndEmit(ctx, [
          '--to',
          rollbackTarget,
          '--name',
          'rollback-phone',
          '--json',
        ]);
        expect(planRollback.exitCode, 'plan rollback --to <dir>^').toBe(0);
        const rollback = parseJsonOutput<PlanJson>(planRollback);
        expect(rollback.from, 'rollback from = current marker C2').toBe(c2Hash);
        expect(rollback.to, 'rollback to = predecessor C1').toBe(c1Hash);
        expect(
          rollback.operations.some((op) => op.operationClass === 'destructive'),
          'reverse delta drops the added column (destructive), no refusal',
        ).toBe(true);

        // Prove the recovery needed no contract-source edit: contract.ts is
        // still the phone (C2) variant, not reverted to base.
        const contractSource = readFileSync(join(ctx.testDir, 'contract.ts'), 'utf-8');
        expect(contractSource, 'contract source untouched (still phone variant)').toContain(
          'phone',
        );

        // Apply the reverse edge; the marker moves back to C1. The reverse
        // delta drops a column, so the user accepts the data loss with `-y`.
        const applyRollback = await runMigrate(ctx, ['--to', rollbackTarget, '-y', '--json']);
        expect(
          applyRollback.exitCode,
          `apply rollback --to <dir>^:\n${applyRollback.stdout}\n${applyRollback.stderr}`,
        ).toBe(0);
        const applied = parseJsonOutput<{ ok: boolean; markerHash: string }>(applyRollback);
        expect(applied.ok, 'rollback applied ok').toBe(true);
        expect(applied.markerHash, 'marker moved back to C1').toBe(c1Hash);

        // Status confirms the live marker is back at the baseline.
        const status = await runMigrationStatus(ctx, ['--json']);
        expect(status.exitCode, 'status after rollback').toBe(0);
        const statusJson = migrationStatusAppSpace(parseMigrationStatusJson(status));
        expect(statusJson.currentContract, 'status marker = C1').toBe(c1Hash);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
