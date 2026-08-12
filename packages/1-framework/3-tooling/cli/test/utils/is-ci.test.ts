import { isCI as ciInfoIsCI } from 'ci-info';
import { describe, expect, it } from 'vitest';
import { isCI } from '../../src/utils/is-ci';

/**
 * Unit-level smoke test for the CI-detection wiring. The per-provider
 * detection matrix is the `ci-info` package's contract; this test just
 * confirms we forward its verdict verbatim. Cross-provider scenario
 * coverage lives in the integration suite that spawns the CLI with
 * provider-specific env-var sets.
 */
describe('isCI', () => {
  it('forwards the `ci-info` package`s verdict verbatim', () => {
    expect(isCI()).toBe(ciInfoIsCI);
    expect(typeof isCI()).toBe('boolean');
  });
});
