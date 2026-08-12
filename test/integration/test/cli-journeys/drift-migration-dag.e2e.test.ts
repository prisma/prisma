/**
 * Migration DAG Drift — Chain Breakage (Journey P3)
 *
 * After building a migration chain (initial → add-name → add-posts), the
 * add-posts directory is deleted from disk. migration status reports the
 * broken chain, migration apply fails (no path to destination), and recovery
 * is achieved by re-planning the missing edge and applying it.
 */

import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  runContractEmit,
  runMigrate,
  runMigrationPlan,
  runMigrationPlanAndEmit,
  runMigrationStatus,
  setupJourney,
  swapContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

withTempDir(({ createTempDir }) => {
  // -------------------------------------------------------------------------
  // Journey P3: Migration Chain Breakage
  // -------------------------------------------------------------------------
  describe('Journey P3: Chain Breakage', () => {
    const db = useDevDatabase();

    it(
      'plan → apply → plan v2 → delete dir → apply fails → re-plan → apply',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        // Precondition: emit base, plan+apply initial, then plan and apply first migration
        const emit0 = await runContractEmit(ctx);
        expect(emit0.exitCode, 'P3.pre: emit base').toBe(0);
        const planInit = await runMigrationPlanAndEmit(ctx, ['--name', 'initial']);
        expect(planInit.exitCode, 'P3.pre: plan initial').toBe(0);
        const applyInit = await runMigrate(ctx);
        expect(applyInit.exitCode, 'P3.pre: apply initial').toBe(0);

        swapContract(ctx, 'contract-additive');
        const emit1 = await runContractEmit(ctx);
        expect(emit1.exitCode, 'P3.pre: emit v2').toBe(0);
        const plan1 = await runMigrationPlanAndEmit(ctx, ['--name', 'add-name']);
        expect(plan1.exitCode, 'P3.pre: plan v2').toBe(0);
        const apply1 = await runMigrate(ctx);
        expect(apply1.exitCode, 'P3.pre: apply v2').toBe(0);

        // Plan a second migration
        swapContract(ctx, 'contract-v3');
        const emit2 = await runContractEmit(ctx);
        expect(emit2.exitCode, 'P3.pre: emit v3').toBe(0);
        const plan2 = await runMigrationPlan(ctx, ['--name', 'add-posts']);
        expect(plan2.exitCode, 'P3.pre: plan v3').toBe(0);

        // Delete the add-posts migration directory (additive→v3 edge)
        // Note: can't use alphabetical sort — 'initial' sorts after 'add-*'.
        // Find by name suffix instead.
        const migrationsDir = join(ctx.testDir, 'migrations', 'app');
        const migrationDirs = readdirSync(migrationsDir);
        const addPostsDir = migrationDirs.find((d) => d.endsWith('_add_posts'));
        expect(addPostsDir, 'P3.pre: add-posts dir exists').toBeDefined();
        rmSync(join(migrationsDir, addPostsDir!), { recursive: true, force: true });

        // P3.01: migration status (reports broken chain — contract has no matching leaf)
        const statusBroken = await runMigrationStatus(ctx);
        expect([0, 1], 'P3.01: status exits 0 or 1').toContain(statusBroken.exitCode);

        // P3.02: migration apply (fails — no path from marker to destination contract)
        const applyFail = await runMigrate(ctx);
        expect(applyFail.exitCode, 'P3.02: migration apply fails').not.toBe(0);

        // P3.03: re-plan the missing edge (chain leaf is additive, contract is v3)
        const rePlan = await runMigrationPlanAndEmit(ctx, ['--name', 're-add-posts']);
        expect(rePlan.exitCode, 'P3.03: migration plan recovery').toBe(0);

        // P3.04: migration apply (applies the re-planned additive→v3 migration)
        const applyRecovery = await runMigrate(ctx);
        expect(applyRecovery.exitCode, 'P3.04: migration apply recovery').toBe(0);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
