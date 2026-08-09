import { describe, expect, it } from 'vitest';
import type { GlobalFlags } from '../../src/utils/global-flags';
import { shouldShowLegend, validateLegendOptions } from '../../src/utils/legend';

const PRETTY: GlobalFlags = { format: 'pretty', explicitFormat: false };
const JSON_FLAGS: GlobalFlags = { format: 'json', explicitFormat: false, json: true };

describe('shouldShowLegend', () => {
  it('shows the legend for the pretty tree path', () => {
    expect(shouldShowLegend({ legend: true }, PRETTY)).toBe(true);
  });

  it('suppresses the legend under --quiet', () => {
    expect(shouldShowLegend({ legend: true }, { ...PRETTY, quiet: true })).toBe(false);
  });

  it('stays hidden without --legend', () => {
    expect(shouldShowLegend({}, PRETTY)).toBe(false);
  });
});

describe('validateLegendOptions', () => {
  it('rejects --legend with --json', () => {
    const result = validateLegendOptions({ legend: true }, JSON_FLAGS);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.message).toContain('--legend');
      expect(result.failure.message).not.toContain('graph');
      expect(result.failure.why).toContain('--json');
      expect(result.failure.code).toBe('MIGRATION.LEGEND_HUMAN_ONLY');
    }
  });

  it('rejects --legend with --quiet', () => {
    const result = validateLegendOptions({ legend: true }, { ...PRETTY, quiet: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('MIGRATION.LEGEND_HUMAN_ONLY');
      expect(result.failure.why).toContain('--quiet');
    }
  });

  it('rejects --legend with --dot', () => {
    const result = validateLegendOptions({ legend: true, dot: true }, PRETTY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.message).toContain('--legend');
      expect(result.failure.why).toContain('--dot');
      expect(result.failure.code).toBe('MIGRATION.LEGEND_HUMAN_ONLY');
    }
  });

  it('accepts --legend on the pretty tree path', () => {
    expect(validateLegendOptions({ legend: true }, PRETTY).ok).toBe(true);
  });
});
