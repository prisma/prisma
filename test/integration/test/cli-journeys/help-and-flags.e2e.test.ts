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
    // Y.01: --no-color
    it(
      'Y.01: --no-color strips the ANSI codes a TTY run carries',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const colored = await runContractEmit(ctx);
        expect(colored.exitCode, 'Y.01: colored emit succeeds').toBe(0);
        const plain = await runContractEmit(ctx, ['--no-color']);
        expect(plain.exitCode, 'Y.01: --no-color emit succeeds').toBe(0);

        // The harness reports a TTY, so the default run colorizes its
        // progress commentary; --no-color must strip every escape code.
        expect(colored.stderr, 'Y.01: TTY run carries ANSI codes').toContain('\u001b[');
        expect(plain.stdout + plain.stderr, 'Y.01: --no-color output is ANSI-free').not.toContain(
          '\u001b[',
        );
      },
      timeouts.typeScriptCompilation,
    );

    // Y.02: -q (quiet)
    it(
      'Y.02: quiet mode drops the progress commentary the default run prints',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const normal = await runContractEmit(ctx);
        expect(normal.exitCode, 'Y.02: normal emit').toBe(0);

        const quiet = await runContractEmit(ctx, ['-q']);
        expect(quiet.exitCode, 'Y.02: quiet emit').toBe(0);

        expect(normal.stderr, 'Y.02: default run narrates progress').toContain('Emitting contract');
        expect(quiet.stderr, 'Y.02: quiet run does not').not.toContain('Emitting contract');
        expect(quiet.stderr.length, 'Y.02: quiet output is strictly shorter').toBeLessThan(
          normal.stderr.length,
        );
      },
      timeouts.typeScriptCompilation,
    );

    // Y.03: -v (verbose)
    it(
      'Y.03: verbose mode adds timings the default run does not print',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const normal = await runContractEmit(ctx);
        expect(normal.exitCode, 'Y.03: normal emit').toBe(0);

        const verbose = await runContractEmit(ctx, ['-v']);
        expect(verbose.exitCode, 'Y.03: verbose emit').toBe(0);

        expect(verbose.stderr, 'Y.03: verbose run reports timings').toContain('Total time');
        expect(normal.stderr, 'Y.03: default run does not').not.toContain('Total time');
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
