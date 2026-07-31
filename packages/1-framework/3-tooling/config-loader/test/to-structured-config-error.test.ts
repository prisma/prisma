import { errorConfigFileNotFound } from '@internal/errors/control';
import { structuredError } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import { toStructuredConfigError } from '../src/load';

describe('toStructuredConfigError', () => {
  it('maps a CONFIG.VALIDATION_FAILED structured error to a CliStructuredError carrying the field reason', () => {
    const mapped = toStructuredConfigError(
      structuredError('CONFIG.VALIDATION_FAILED', 'collides with input', {
        why: 'collides with input',
        meta: { field: 'contract.output' },
      }),
    );

    expect(mapped).toMatchObject({
      name: 'CliStructuredError',
      code: 'CONFIG.VALIDATION_FAILED',
      why: 'collides with input',
    });
  });

  it('maps a CONFIG.VALIDATION_FAILED structured error without field or why using the config fallback and message', () => {
    const mapped = toStructuredConfigError(
      structuredError('CONFIG.VALIDATION_FAILED', 'invalid config shape'),
    );

    expect(mapped).toMatchObject({
      name: 'CliStructuredError',
      code: 'CONFIG.VALIDATION_FAILED',
      why: 'invalid config shape',
    });
  });

  it('passes a CONFIG.FILE_NOT_FOUND CliStructuredError through unchanged', () => {
    const notFound = errorConfigFileNotFound('/project/prisma-next.config.ts');

    expect(toStructuredConfigError(notFound)).toBe(notFound);
  });

  it('passes a structured error (one carrying a string code) through unchanged', () => {
    const structured = Object.assign(new Error('already structured'), { code: '4123' });

    expect(toStructuredConfigError(structured)).toBe(structured);
  });

  it('maps an ENOENT-flavoured plain error to a CONFIG.FILE_NOT_FOUND with the resolved display path', () => {
    const mapped = toStructuredConfigError(
      new Error('ENOENT: no such file'),
      'prisma-next.config.ts',
    );

    expect(mapped).toMatchObject({
      name: 'CliStructuredError',
      code: 'CONFIG.FILE_NOT_FOUND',
      why: 'ENOENT: no such file',
    });
  });

  it('maps a "not found" plain error without a configPath to a CONFIG.FILE_NOT_FOUND', () => {
    const mapped = toStructuredConfigError(new Error('module not found'));

    expect(mapped).toMatchObject({
      name: 'CliStructuredError',
      code: 'CONFIG.FILE_NOT_FOUND',
    });
  });

  it('wraps any other plain error in a CLI.UNEXPECTED unexpected error', () => {
    const mapped = toStructuredConfigError(new Error('boom'));

    expect(mapped).toMatchObject({
      name: 'CliStructuredError',
      code: 'CLI.UNEXPECTED',
      why: 'Failed to load config: boom',
    });
  });

  it('stringifies a non-Error throwable into a CLI.UNEXPECTED unexpected error', () => {
    const mapped = toStructuredConfigError('not even an error');

    expect(mapped).toMatchObject({
      name: 'CliStructuredError',
      code: 'CLI.UNEXPECTED',
    });
  });
});
