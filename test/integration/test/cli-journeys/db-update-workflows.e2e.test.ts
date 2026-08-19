/**
 * Database Update Workflows (Journeys D + E)
 *
 * D — Direct update without migrations: swap to an additive contract, dry-run
 *     to preview changes, apply, confirm noop on re-run, then verify.
 *
 * E — Destructive update with confirmation: swap to a contract that drops a
 *     column, test that --no-interactive blocks destructive changes, --json
 *     returns an error envelope, and --json -y auto-accepts and succeeds.
 *
 * Marker-aware violations (orphan markers, declared-but-unmigrated
 * extension spaces) are caught by the contract-space verifier — see
 * `cli.db-init.contract-space-verifier.test.ts` and
 * `cli.db-update.contract-space-verifier.test.ts`.
 */

import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  consentTokenFor,
  type JourneyContext,
  parseJsonOutput,
  runContractEmit,
  runDbInit,
  runDbUpdate,
  runDbVerify,
  setupJourney,
  swapContract,
  timeouts,
  useDevDatabase,
} from '../utils/journey-test-helpers';

withTempDir(({ createTempDir }) => {
  // -------------------------------------------------------------------------
  // Journey D: Direct Update (No Migrations)
  // -------------------------------------------------------------------------
  describe('Journey D: Direct Update', () => {
    const db = useDevDatabase();

    it(
      'emit → init → swap → update dry-run → update → update noop → verify',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        // Precondition
        const emit0 = await runContractEmit(ctx);
        expect(emit0.exitCode, 'D.pre: emit').toBe(0);
        const init = await runDbInit(ctx);
        expect(init.exitCode, 'D.pre: init').toBe(0);

        // D.01: Swap to contract-additive, contract emit
        swapContract(ctx, 'contract-additive');
        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'D.01: contract emit v2').toBe(0);

        // D.02: db update --dry-run
        const dryRun = await runDbUpdate(ctx, ['--dry-run']);
        expect(dryRun.exitCode, 'D.02: db update dry-run').toBe(0);
        expect(stripAnsi(dryRun.stderr), 'D.02: shows planned ops').toContain('Planned');

        // D.03: db update
        const update = await runDbUpdate(ctx);
        expect(update.exitCode, 'D.03: db update apply').toBe(0);

        // D.04: db update (noop)
        const updateNoop = await runDbUpdate(ctx);
        expect(updateNoop.exitCode, 'D.04: db update noop').toBe(0);

        // D.05: db verify
        const verify = await runDbVerify(ctx);
        expect(verify.exitCode, 'D.05: db verify').toBe(0);
      },
      timeouts.spinUpPpgDev,
    );
  });

  // -------------------------------------------------------------------------
  // Journey E: Destructive Update with Confirmation
  // -------------------------------------------------------------------------
  describe('Journey E: Destructive Update', () => {
    const db = useDevDatabase();

    it(
      'emit → init → destructive update scenarios',
      async () => {
        const ctx: JourneyContext = setupJourney({
          connectionString: db.connectionString,
          createTempDir,
        });

        // Precondition
        const emit0 = await runContractEmit(ctx);
        expect(emit0.exitCode, 'E.pre: emit').toBe(0);
        const init = await runDbInit(ctx);
        expect(init.exitCode, 'E.pre: init').toBe(0);

        // E.01: Swap to contract-destructive, contract emit
        swapContract(ctx, 'contract-destructive');
        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'E.01: contract emit destructive').toBe(0);

        // E.02: db update --dry-run
        const dryRun = await runDbUpdate(ctx, ['--dry-run']);
        expect(dryRun.exitCode, 'E.02: db update dry-run').toBe(0);

        // E.03: db update --no-interactive — nobody to ask, so consent is required
        const noInteractive = await runDbUpdate(ctx, ['--json', '--no-interactive']);
        expect(noInteractive.exitCode, 'E.03: non-interactive destructive fails').toBe(2);
        expect(parseJsonOutput(noInteractive), 'E.03: consent error').toMatchObject({
          code: 'CLI.CONSENT_REQUIRED',
        });

        // E.04: db update --yes — --yes accepts declared defaults, never data loss
        const yesAlone = await runDbUpdate(ctx, ['--json', '--yes']);
        expect(yesAlone.exitCode, 'E.04: --yes does not grant consent').toBe(2);
        expect(parseJsonOutput(yesAlone), 'E.04: consent error').toMatchObject({
          code: 'CLI.CONSENT_REQUIRED',
        });

        // E.05: db update --confirm <database> — the non-interactive grant
        const confirmed = await runDbUpdate(ctx, [
          '--json',
          '--confirm',
          consentTokenFor(db.connectionString),
        ]);
        expect(confirmed.exitCode, 'E.05: --confirm applies').toBe(0);
        expect(parseJsonOutput(confirmed), 'E.05: success envelope').toMatchObject({ ok: true });
      },
      timeouts.spinUpPpgDev,
    );
  });

  // -------------------------------------------------------------------------
  // Journey O: db init on Already-Initialized DB (Different Contract)
  // -------------------------------------------------------------------------
});
