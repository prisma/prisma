import type { PrismaNextConfig } from '@internal/config/config-types';
import { CliStructuredError, errorConfigValidation } from '@internal/errors/control';
import { describe, expect, it } from 'vitest';
import { type LoadedConfig, requireConfigSections } from '../src/load';

const config = { family: {}, target: {}, adapter: {} } as unknown as PrismaNextConfig;

function loaded(diagnostics: readonly CliStructuredError[]): LoadedConfig {
  return { config, diagnostics };
}

describe('requireConfigSections', () => {
  it('returns the config when there are no diagnostics', () => {
    const result = requireConfigSections(loaded([]), ['family', 'db']);
    expect(result.assertOk()).toBe(config);
  });

  it('returns the config when diagnostics concern other sections', () => {
    const formatterDiagnostic = errorConfigValidation('formatter.indent', {
      section: 'formatter',
    });
    const result = requireConfigSections(loaded([formatterDiagnostic]), ['db', 'driver']);
    expect(result.assertOk()).toBe(config);
  });

  it('fails with the first diagnostic that concerns a required section', () => {
    const formatterDiagnostic = errorConfigValidation('formatter.indent', {
      section: 'formatter',
    });
    const driverDiagnostic = errorConfigValidation('driver.kind', { section: 'driver' });
    const result = requireConfigSections(loaded([formatterDiagnostic, driverDiagnostic]), [
      'driver',
    ]);
    expect(result.assertNotOk()).toBe(driverDiagnostic);
  });

  it('treats a diagnostic without a section as blocking every command', () => {
    const sectionless = new CliStructuredError('CONFIG.VALIDATION_FAILED', 'broken config');
    const result = requireConfigSections(loaded([sectionless]), ['migrations']);
    expect(result.assertNotOk()).toBe(sectionless);
  });
});
