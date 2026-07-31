import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countSemanticLines } from '@repo/test-utils/semantic-lines';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, 'parity', 'callback-mode-scalars');

describe('VP2: TS callback-mode authoring terseness parity', () => {
  it('ignores block comments and trailing inline comments', () => {
    expect(
      countSemanticLines(`
        // comment
        model User {
          /*
           * comment
           */
          id Int // comment
          email String
        }
      `),
    ).toBe(4);
  });

  it('preserves line breaks from multi-line block comments', () => {
    expect(countSemanticLines('const a = 1; /* comment\nstill comment */ const b = 2;')).toBe(2);
  });

  const pslSource = readFileSync(join(fixtureDir, 'schema.prisma'), 'utf-8');
  const tsSource = readFileSync(join(fixtureDir, 'contract.ts'), 'utf-8');
  const pslLines = countSemanticLines(pslSource);
  const tsLines = countSemanticLines(tsSource);
  const ratio = tsLines / pslLines;

  it('keeps the callback-mode TS contract in the ~1.5–2.1x PSL ballpark', () => {
    // VP2 stop condition: "The TypeScript version of a representative
    // contract is in the same ballpark of length as the PSL version."
    //
    // Baseline (April milestone): structural TS authoring was ~3–5x the
    // PSL version. The callback-mode field presets (contributed by
    // @internal/target-postgres/pack) should collapse scalar fields to
    // one line each, pulling the ratio well under the baseline.
    //
    // The upper bound of 2.1x is intentional: any drift above 2.1x should
    // force a re-review of the preset vocabulary rather than silently
    // widen the acceptance window.
    expect(ratio).toBeLessThanOrEqual(2.1);
    expect(ratio).toBeGreaterThan(0);
  });

  it('is measurably tighter than the structural core-surface baseline', () => {
    const coreSurfaceDir = join(__dirname, 'parity', 'core-surface');
    const coreSurfacePsl = readFileSync(join(coreSurfaceDir, 'schema.prisma'), 'utf-8');
    const coreSurfaceTs = readFileSync(join(coreSurfaceDir, 'contract.ts'), 'utf-8');
    const coreRatio = countSemanticLines(coreSurfaceTs) / countSemanticLines(coreSurfacePsl);

    expect(ratio).toBeLessThan(coreRatio);
  });
});
