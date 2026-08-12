/**
 * Staging Ahead via Refs + Marker Ahead of Ref (Journeys M + N — spec P-5/P-6)
 *
 * M — Refs route apply and status to different targets on the same DB:
 *   - production=C1, staging=C2
 *   - apply --ref staging advances staging; production unaffected
 *
 * N — Marker-ahead-of-ref scenario (continuation of M):
 *   - After staging apply, DB marker is at C2
 *   - Set production ref to C1 (behind DB)
 *   - apply --ref production fails (no backward edge from C2 to C1)
 */

import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  migrationStatusAppSpace,
  parseJsonOutput,
  parseMigrationStatusJson,
  runContractEmit,
  runMigrate,
  runMigrationPlanAndEmit,
  runMigrationStatus,
  runRef,
  setupJourney,
  swapContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

withTempDir(({ createTempDir }) => {
  describe('Journey M+N: Ref Routing and Marker Ahead (P-5/P-6)', () => {
    const db = useDevDatabase();

    it(
      'staging ref ahead of production → apply --ref staging → marker ahead of production ref',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        // M.01: emit base (C1) → plan + apply init
        const emit0 = await runContractEmit(ctx);
        expect(emit0.exitCode, 'M.01: emit C1').toBe(0);
        const plan0 = await runMigrationPlanAndEmit(ctx, ['--name', 'init', '--json']);
        expect(plan0.exitCode, 'M.01: plan init').toBe(0);
        const c1Hash = parseJsonOutput<{ to: string }>(plan0).to;
        const apply0 = await runMigrate(ctx);
        expect(apply0.exitCode, 'M.01: apply init').toBe(0);

        // M.02: swap to contract-phone (C2) → emit → plan add-phone (C1→C2)
        swapContract(ctx, 'contract-phone');
        const emit1 = await runContractEmit(ctx);
        expect(emit1.exitCode, 'M.02: emit C2').toBe(0);
        const plan1 = await runMigrationPlanAndEmit(ctx, ['--name', 'add-phone', '--json']);
        expect(plan1.exitCode, 'M.02: plan C1→C2').toBe(0);
        const c2Hash = parseJsonOutput<{ to: string }>(plan1).to;

        // M.03: set refs — production=C1, staging=C2
        const refProd = await runRef(ctx, ['set', 'production', c1Hash]);
        expect(refProd.exitCode, 'M.03: ref set production=C1').toBe(0);
        const refStaging = await runRef(ctx, ['set', 'staging', c2Hash]);
        expect(refStaging.exitCode, 'M.03: ref set staging=C2').toBe(0);

        // M.04: status --ref production → at-target (DB marker = C1, ref = C1)
        const statusProd = await runMigrationStatus(ctx, ['--to', 'production', '--json']);
        expect(statusProd.exitCode, 'M.04: status --ref production').toBe(0);
        const prodStatus = migrationStatusAppSpace(parseMigrationStatusJson(statusProd));
        const prodPending = prodStatus.migrations.filter((m) => m.status === 'pending').length;
        expect(prodPending, 'M.04: production has 0 pending').toBe(0);

        // M.05: status --ref staging → 1 pending (DB marker = C1, ref = C2)
        const statusStaging = await runMigrationStatus(ctx, ['--to', 'staging', '--json']);
        expect(statusStaging.exitCode, 'M.05: status --ref staging').toBe(0);
        const stagingStatus = migrationStatusAppSpace(parseMigrationStatusJson(statusStaging));
        const stagingPending = stagingStatus.migrations.filter(
          (m) => m.status === 'pending',
        ).length;
        expect(stagingPending, 'M.05: staging has 1 pending').toBe(1);

        // M.06: apply --ref staging → advances DB to C2
        const applyStaging = await runMigrate(ctx, ['--to', 'staging', '--json']);
        expect(applyStaging.exitCode, 'M.06: apply --ref staging').toBe(0);
        const applyStagingResult = parseJsonOutput<{
          ok: boolean;
          migrationsApplied: number;
          markerHash: string;
        }>(applyStaging);
        expect(applyStagingResult.ok, 'M.06: ok').toBe(true);
        expect(applyStagingResult.migrationsApplied, 'M.06: applied 1').toBe(1);
        expect(applyStagingResult.markerHash, 'M.06: marker at C2').toBe(c2Hash);

        // M.07: status --ref production unchanged (still 0 pending, but DB is now at C2)
        // The production ref points to C1 which is behind the DB marker C2.
        // This transitions into the P-6 scenario (marker ahead of ref).

        // N.01: apply --ref production fails (DB at C2, ref at C1, no backward edge)
        const applyProdFail = await runMigrate(ctx, ['--to', 'production', '--json']);
        expect(applyProdFail.exitCode, 'N.01: apply --ref production fails').toBe(2);

        // N.02: status --ref production reports ahead-of-ref condition
        const statusProdAfter = await runMigrationStatus(ctx, ['--to', 'production', '--json']);
        const prodAfterOutput = stripAnsi(statusProdAfter.stdout);
        expect(prodAfterOutput, 'N.02: production status indicates ahead-of-ref condition').toMatch(
          /ahead|no.*path|mismatch|cannot reach/i,
        );
      },
      timeouts.spinUpPpgDev,
    );
  });
});
