/**
 * Same-Base Divergence (Journey L — spec scenario P-4/S-4)
 *
 * Tests that divergent migration branches (two edges from the same source)
 * are handled gracefully. Creates:
 *   C1 → C2 (add-phone, on disk but not applied)
 *   C1 → C3 (add-bio, via --from C1)
 * Without --ref, status auto-resolves to the contract hash if it matches
 * a graph node. With ref production=C3, apply routes via C1→C3.
 */

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
  describe('Journey L: Same-Base Divergence (P-4/S-4)', () => {
    const db = useDevDatabase();

    it(
      'divergent branches → status resolves via contract hash → ref-based apply',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        // L.01: emit base (C1) → plan + apply init
        const emit0 = await runContractEmit(ctx);
        expect(emit0.exitCode, 'L.01: emit C1').toBe(0);
        const plan0 = await runMigrationPlanAndEmit(ctx, ['--name', 'init', '--json']);
        expect(plan0.exitCode, 'L.01: plan init').toBe(0);
        const c1Hash = parseJsonOutput<{ to: string }>(plan0).to;
        const apply0 = await runMigrate(ctx);
        expect(apply0.exitCode, 'L.01: apply init').toBe(0);

        // L.02: swap to contract-phone (C2) → emit → plan add-phone (don't apply)
        swapContract(ctx, 'contract-phone');
        const emit1 = await runContractEmit(ctx);
        expect(emit1.exitCode, 'L.02: emit C2').toBe(0);
        const plan1 = await runMigrationPlanAndEmit(ctx, ['--name', 'add-phone', '--json']);
        expect(plan1.exitCode, 'L.02: plan C1→C2').toBe(0);
        const c2Hash = parseJsonOutput<{ to: string }>(plan1).to;

        // L.03: swap to contract-bio (C3) → emit → plan with --from C1 (C1→C3 divergent edge)
        swapContract(ctx, 'contract-bio');
        const emit2 = await runContractEmit(ctx);
        expect(emit2.exitCode, 'L.03: emit C3').toBe(0);
        const plan2 = await runMigrationPlanAndEmit(ctx, [
          '--name',
          'add-bio',
          '--from',
          c1Hash,
          '--json',
        ]);
        expect(plan2.exitCode, 'L.03: plan C1→C3').toBe(0);
        const c3Hash = parseJsonOutput<{ to: string }>(plan2).to;
        expect(c3Hash, 'L.03: C3 differs from C2').not.toBe(c2Hash);

        // L.04: status without --ref succeeds — auto-resolves to contract hash (C3)
        const statusAuto = await runMigrationStatus(ctx, ['--json']);
        expect(statusAuto.exitCode, 'L.04: status succeeds').toBe(0);
        const statusData = parseMigrationStatusJson(statusAuto);
        expect(statusData.ok, 'L.04: ok').toBe(true);
        expect(
          migrationStatusAppSpace(statusData).targetContract,
          'L.04: target is C3 (contract hash)',
        ).toBe(c3Hash);

        // L.05: set ref production=C3
        const refSet = await runRef(ctx, ['set', 'production', c3Hash]);
        expect(refSet.exitCode, 'L.05: ref set production').toBe(0);

        // L.06: apply with --ref production → routes via C1→C3
        const applyRef = await runMigrate(ctx, ['--to', 'production', '--json']);
        expect(applyRef.exitCode, 'L.06: apply --ref production').toBe(0);
        const applyResult = parseJsonOutput<{
          ok: boolean;
          migrationsApplied: number;
          markerHash: string;
        }>(applyRef);
        expect(applyResult.ok, 'L.06: ok').toBe(true);
        expect(applyResult.migrationsApplied, 'L.06: applied 1').toBe(1);
        expect(applyResult.markerHash, 'L.06: marker at C3').toBe(c3Hash);

        // L.07: status with --ref production
        const statusRef = await runMigrationStatus(ctx, ['--to', 'production', '--json']);
        expect(statusRef.exitCode, 'L.07: status --ref production').toBe(0);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
