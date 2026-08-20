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
    // --no-color
    it(
      '--no-color strips the ANSI codes a TTY run carries',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const colored = await runContractEmit(ctx);
        expect(colored.exitCode, 'colored emit succeeds').toBe(0);
        const plain = await runContractEmit(ctx, ['--no-color']);
        expect(plain.exitCode, '--no-color emit succeeds').toBe(0);

        // The harness reports a TTY, so the default run colorizes its
        // progress commentary; --no-color must strip every escape code.
        expect(colored.stderr, 'TTY run carries ANSI codes').toContain('\u001b[');
        expect(plain.stdout + plain.stderr, '--no-color output is ANSI-free').not.toContain(
          '\u001b[',
        );
      },
      timeouts.typeScriptCompilation,
    );

    // -q (quiet)
    it(
      'quiet mode drops the progress commentary the default run prints',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const normal = await runContractEmit(ctx);
        expect(normal.exitCode, 'normal emit').toBe(0);

        const quiet = await runContractEmit(ctx, ['-q']);
        expect(quiet.exitCode, 'quiet emit').toBe(0);

        expect(normal.stderr, 'default run narrates progress').toContain('Emitting contract');
        expect(quiet.stderr, 'quiet run does not').not.toContain('Emitting contract');
        expect(quiet.stderr.length, 'quiet output is strictly shorter').toBeLessThan(
          normal.stderr.length,
        );
      },
      timeouts.typeScriptCompilation,
    );

    // -v (verbose)
    it(
      'verbose mode adds timings the default run does not print',
      async () => {
        const ctx = setupJourney({ createTempDir });

        const normal = await runContractEmit(ctx);
        expect(normal.exitCode, 'normal emit for the verbose comparison').toBe(0);

        const verbose = await runContractEmit(ctx, ['-v']);
        expect(verbose.exitCode, 'verbose emit').toBe(0);

        expect(verbose.stderr, 'verbose run reports timings').toContain('Total time');
        expect(normal.stderr, 'default run reports no timings').not.toContain('Total time');
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
