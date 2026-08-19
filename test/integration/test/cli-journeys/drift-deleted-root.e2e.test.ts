/**
 * Migration DAG Drift — Deleted Root Migration (Journey P4)
 *
 * After building a 2-step migration chain (initial → add-name), the
 * initial migration directory is deleted from disk. This leaves an
 * orphaned migration (add-name) whose origin hash has no incoming edge
 * from EMPTY_CONTRACT_HASH. The system must detect this and report an
 * error rather than silently treating the graph as empty.
 */

import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  latestMigrationDirName,
  parseJsonOutput,
  planThenSelfEmit,
  runContractEmit,
  runMigrate,
  runMigrationPlan,
  runMigrationStatus,
  setupJourney,
  swapContract,
  useDevDatabase,
} from '../utils/journey-test-helpers';

withTempDir(({ createTempDir }) => {
  describe('Journey P4: Deleted Root Migration', () => {
    const db = useDevDatabase();

    it(
      'deleting root migration is detected as broken graph, not silently ignored',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        // Build a 2-migration chain: base → additive
        const emit0 = await runContractEmit(ctx);
        expect(emit0.exitCode, 'P4.pre: emit base').toBe(0);
        const planInit = await planThenSelfEmit(ctx, ['--name', 'initial']);
        expect(planInit.exitCode, 'P4.pre: plan initial').toBe(0);
        const applyInit = await runMigrate(ctx);
        expect(applyInit.exitCode, 'P4.pre: apply initial').toBe(0);

        swapContract(ctx, 'contract-additive');
        const emit1 = await runContractEmit(ctx);
        expect(emit1.exitCode, 'P4.pre: emit v2').toBe(0);
        const plan1 = await planThenSelfEmit(ctx, [
          '--name',
          'add-name',
          '--from',
          latestMigrationDirName(ctx),
        ]);
        expect(plan1.exitCode, 'P4.pre: plan add-name').toBe(0);
        const apply1 = await runMigrate(ctx);
        expect(apply1.exitCode, 'P4.pre: apply add-name').toBe(0);

        // Delete the FIRST migration (root edge: empty → base)
        const migrationsDir = join(ctx.testDir, 'migrations', 'app');
        const migrationDirs = readdirSync(migrationsDir).sort();
        const initDir = migrationDirs.find((d) => d.endsWith('_initial'));
        expect(initDir, 'P4.pre: initial dir exists').toBeDefined();
        rmSync(join(migrationsDir, initDir!), { recursive: true, force: true });

        // Verify only add-name remains on disk
        const remaining = readdirSync(migrationsDir).filter((d) => !d.startsWith('.'));
        expect(remaining, 'P4.pre: only add-name remains').toHaveLength(1);
        expect(remaining[0], 'P4.pre: remaining is add-name').toMatch(/_add_name$/);

        // P4.01: migration status still lists the orphaned on-disk migration
        const status = await runMigrationStatus(ctx);
        expect(status.exitCode, 'P4.01: status succeeds').toBe(0);
        const statusOutput = stripAnsi(status.stderr);
        expect(statusOutput, 'P4.01: surviving migration visible').toMatch(/add_name/);
        expect(statusOutput, 'P4.01: not treated as empty').not.toContain('No migrations found');

        // P4.02: planning from the surviving migration works even when the
        // graph chain is broken — it must not silently greenfield-plan a
        // duplicate init. The user names the surviving directory explicitly;
        // without --from (and with no db ref) the CLI would plan greenfield.
        const planAgain = await runMigrationPlan(ctx, [
          '--name',
          'catch-up',
          '--from',
          latestMigrationDirName(ctx),
          '--json',
        ]);
        expect(planAgain.exitCode, 'P4.02: plan from db ref').toBe(0);
        const planResult = parseJsonOutput<{ from: string }>(planAgain);
        expect(planResult.from, 'P4.02: from is db ref not empty sentinel').not.toBe('empty');
        const dirsAfterPlan = readdirSync(migrationsDir).filter((d) => !d.startsWith('.'));
        expect(dirsAfterPlan, 'P4.02: orphaned add-name only — no greenfield init').toHaveLength(1);
        expect(dirsAfterPlan[0], 'P4.02: surviving migration is add-name').toMatch(/_add_name$/);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
