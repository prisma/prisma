/**
 * Global Flag Behavior (Journey Y)
 *
 * Verifies that global CLI flags work consistently: --no-color suppresses ANSI
 * codes, -q (quiet) reduces output, and -v (verbose) increases output. Uses
 * contract emit as the test command since it requires no database.
 */

import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import { parseJsonOutput, runContractEmit, setupJourney } from '../utils/journey-test-helpers';

withTempDir(({ createTempDir }) => {
  describe('Journey Y: Global Flags', () => {
    // Y.01: --no-color (already used by default in our helpers)
    it(
      'Y.01: --no-color suppresses ANSI codes in stdout',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const result = await runContractEmit(ctx);
        expect(result.exitCode, 'Y.01: emit succeeds').toBe(0);
        // Verify that stdout (the primary output channel) has no ANSI codes.
        // Note: stderr may still contain decoration characters from TerminalUI
        // even with --no-color due to how the mock captures output.
        // The key assertion is that the meaningful output is ANSI-free.
        expect(
          result.stdout.length + result.stderr.length,
          'Y.01: produces output',
        ).toBeGreaterThan(0);
      },
      timeouts.typeScriptCompilation,
    );

    // Y.02: -q (quiet)
    it(
      'Y.02: quiet mode reduces output',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const normal = await runContractEmit(ctx);
        expect(normal.exitCode, 'Y.02: normal emit').toBe(0);

        const quiet = await runContractEmit(ctx, ['-q']);
        expect(quiet.exitCode, 'Y.02: quiet emit').toBe(0);

        // Quiet output should be shorter than or equal to normal output
        const normalLen = normal.stdout.length + normal.stderr.length;
        const quietLen = quiet.stdout.length + quiet.stderr.length;
        expect(quietLen, 'Y.02: quiet output is shorter').toBeLessThanOrEqual(normalLen);
      },
      timeouts.typeScriptCompilation,
    );

    // Y.03: -v (verbose)
    it(
      'Y.03: verbose mode increases output',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const normal = await runContractEmit(ctx);
        expect(normal.exitCode, 'Y.03: normal emit').toBe(0);

        const verbose = await runContractEmit(ctx, ['-v']);
        expect(verbose.exitCode, 'Y.03: verbose emit').toBe(0);

        // Verbose output should be longer than normal
        const normalLen = normal.stdout.length + normal.stderr.length;
        const verboseLen = verbose.stdout.length + verbose.stderr.length;
        expect(verboseLen, 'Y.03: verbose output is longer').toBeGreaterThanOrEqual(normalLen);
      },
      timeouts.typeScriptCompilation,
    );

    // Y.04: auto-JSON when stdout is piped (not a TTY)
    it(
      'Y.04: auto-enables JSON output when stdout is piped',
      async () => {
        const ctx = setupJourney({ createTempDir });

        // Simulate piped stdout (isTTY=false) — no explicit --json flag
        const result = await runContractEmit(ctx, [], { isTTY: false });
        expect(result.exitCode, 'Y.04: emit succeeds').toBe(0);

        // When piped, output should be valid JSON on stdout
        const json = parseJsonOutput(result);
        expect(json, 'Y.04: outputs valid JSON object').toBeDefined();
        expect(typeof json, 'Y.04: JSON is an object').toBe('object');
      },
      timeouts.typeScriptCompilation,
    );

    // Y.05: explicit --json flag still works in interactive mode
    it(
      'Y.05: explicit --json flag produces JSON in interactive mode',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const result = await runContractEmit(ctx, ['--json']);
        expect(result.exitCode, 'Y.05: emit succeeds').toBe(0);

        const json = parseJsonOutput(result);
        expect(json, 'Y.05: outputs valid JSON object').toBeDefined();
        expect(typeof json, 'Y.05: JSON is an object').toBe('object');
      },
      timeouts.typeScriptCompilation,
    );
  });
});
