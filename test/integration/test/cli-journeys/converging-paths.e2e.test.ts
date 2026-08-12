/**
 * Converging Paths (Journey K — spec scenario P-3/S-3)
 *
 * Tests that when multiple migration paths lead to the same target,
 * the pathfinder selects the shortest path. Creates a graph with:
 *   C1 → C2 (add-phone)
 *   C2 → C3 (add-phone-bio, via C2)
 *   C1 → C3 (direct shortcut, via --from C1)
 * Applies from empty — shortest path (∅→C1→C3) is selected over ∅→C1→C2→C3.
 */

import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  parseJsonOutput,
  runContractEmit,
  runMigrate,
  runMigrationPlanAndEmit,
  setupJourney,
  swapContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

withTempDir(({ createTempDir }) => {
  describe('Journey K: Converging Paths (P-3/S-3)', () => {
    const db = useDevDatabase();

    it(
      'shortest path selected over longer alternative when graph converges',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        // K.01: emit base contract (C1) → plan init
        const emit0 = await runContractEmit(ctx);
        expect(emit0.exitCode, 'K.01: emit C1').toBe(0);
        const plan0 = await runMigrationPlanAndEmit(ctx, ['--name', 'init', '--json']);
        expect(plan0.exitCode, 'K.01: plan init').toBe(0);
        const c1Hash = parseJsonOutput<{ to: string }>(plan0).to;

        // K.02: swap to contract-phone (C2) → emit → plan add-phone (C1→C2)
        swapContract(ctx, 'contract-phone');
        const emit1 = await runContractEmit(ctx);
        expect(emit1.exitCode, 'K.02: emit C2').toBe(0);
        const plan1 = await runMigrationPlanAndEmit(ctx, ['--name', 'add-phone', '--json']);
        expect(plan1.exitCode, 'K.02: plan C1→C2').toBe(0);
        parseJsonOutput<{ to: string }>(plan1);

        // K.03: swap to contract-phone-bio (C3) → emit → plan from C2 (C2→C3)
        swapContract(ctx, 'contract-phone-bio');
        const emit2 = await runContractEmit(ctx);
        expect(emit2.exitCode, 'K.03: emit C3').toBe(0);
        const plan2 = await runMigrationPlanAndEmit(ctx, ['--name', 'add-bio-via-c2', '--json']);
        expect(plan2.exitCode, 'K.03: plan C2→C3').toBe(0);
        const c3Hash = parseJsonOutput<{ to: string }>(plan2).to;

        // K.04: plan direct shortcut from C1→C3 (creates a shorter alternative)
        const planDirect = await runMigrationPlanAndEmit(ctx, [
          '--name',
          'direct-to-c3',
          '--from',
          c1Hash,
          '--json',
        ]);
        expect(planDirect.exitCode, 'K.04: plan C1→C3 direct').toBe(0);
        const directResult = parseJsonOutput<{ from: string; to: string }>(planDirect);
        expect(directResult.from, 'K.04: from C1').toBe(c1Hash);
        expect(directResult.to, 'K.04: to C3').toBe(c3Hash);

        // K.05: apply from empty DB — pathfinder picks shortest path (∅→C1→C3)
        const apply = await runMigrate(ctx, ['--json']);
        expect(apply.exitCode, 'K.05: apply converging graph').toBe(0);

        const applyResult = parseJsonOutput<{
          ok: boolean;
          migrationsApplied: number;
          markerHash: string;
        }>(apply);
        expect(applyResult.ok, 'K.05: ok').toBe(true);
        expect(applyResult.markerHash, 'K.05: marker at C3').toBe(c3Hash);
        // Shortest path is ∅→C1→C3 (2 migrations), not ∅→C1→C2→C3 (3 migrations)
        expect(applyResult.migrationsApplied, 'K.05: shortest path = 2 steps').toBe(2);
      },
      timeouts.spinUpPpgDev,
    );
  });
});
