import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guardrail for the consolidated CI-detection rule.
 *
 * `ci-info` (surfaced through `isCI()` in `cli/src/utils/is-ci.ts`) is the
 * single source of truth for CI detection across this CLI — colour-output
 * suppression and telemetry-skip share the same definition by construction.
 * Re-introducing a raw `process.env.CI` read elsewhere would let the two
 * code paths drift the moment a new provider is added upstream.
 *
 * The scan is a `git grep` over the workspace's `packages/**` source tree.
 * The single permitted match is the `isCI` definition itself; everything
 * else is a violation. `is-ci.ts` mentions the legacy literal in a comment
 * (documenting what the helper supersedes), so the violation regex
 * deliberately targets code-shaped reads only.
 */
describe('no parallel CI detection', () => {
  it('finds no source-level `process.env.CI` / `process.env["CI"]` reads under packages/', () => {
    const repoRoot = resolve(__dirname, '../../../../../..');
    let out: string;
    try {
      out = execSync(
        // -E: extended regex; -n: line numbers; -I: skip binaries
        'git grep -EnI "process\\.env(\\.CI\\b|\\[\'CI\'\\]|\\[\\"CI\\"\\])" -- \'packages/**/*.ts\'',
        { cwd: repoRoot, encoding: 'utf-8' },
      );
    } catch (err) {
      const exitCode = (err as { status?: number }).status;
      if (exitCode === 1) {
        // git grep returns 1 when there are no matches; the rule is satisfied.
        return;
      }
      throw err;
    }
    const offending = out
      .split('\n')
      .filter((line) => line.length > 0)
      // The canonical helper documents the legacy literal in a comment line
      // explaining what `isCI()` supersedes — that string isn't a code-level
      // read. Filter the helper's own path out so the rule stays strict for
      // every other source file.
      .filter((line) => !line.startsWith('packages/1-framework/3-tooling/cli/src/utils/is-ci.ts:'))
      // The audit's own test file mentions the literal in its test name;
      // it's not a code-level read either.
      .filter(
        (line) =>
          !line.startsWith(
            'packages/1-framework/3-tooling/cli/test/utils/no-parallel-ci-detection.test.ts:',
          ),
      );
    expect(offending).toEqual([]);
  });
});
