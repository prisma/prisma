import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CliStructuredError,
  errorInvalidOutputFormat,
  errorOutputFormatMutex,
} from '../../src/utils/cli-errors';
import { deriveCanPrompt, parseGlobalFlags } from '../../src/utils/global-flags';

describe('parseGlobalFlags output format', () => {
  const originalIsTTY = process.stdout.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
  });

  it('defaults to pretty on a TTY when no format flags are set', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const flags = parseGlobalFlags({});
    expect(flags.format).toBe('pretty');
    expect(flags.explicitFormat).toBe(false);
    expect(flags.json).toBeUndefined();
  });

  it('defaults to json when stdout is not a TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const flags = parseGlobalFlags({});
    expect(flags.format).toBe('json');
    expect(flags.explicitFormat).toBe(false);
    expect(flags.json).toBe(true);
  });

  it('honours --format pretty on a non-TTY', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });
    const flags = parseGlobalFlags({ format: 'pretty' });
    expect(flags.format).toBe('pretty');
    expect(flags.explicitFormat).toBe(true);
    expect(flags.json).toBeUndefined();
  });

  it('honours --format json', () => {
    const flags = parseGlobalFlags({ format: 'json' });
    expect(flags.format).toBe('json');
    expect(flags.explicitFormat).toBe(true);
    expect(flags.json).toBe(true);
  });

  it('treats --json as --format json', () => {
    const flags = parseGlobalFlags({ json: true });
    expect(flags.format).toBe('json');
    expect(flags.explicitFormat).toBe(false);
    expect(flags.json).toBe(true);
  });

  it('allows --format json together with --json', () => {
    const flags = parseGlobalFlags({ format: 'json', json: true });
    expect(flags.format).toBe('json');
    expect(flags.explicitFormat).toBe(true);
    expect(flags.json).toBe(true);
  });

  it('rejects --format pretty together with --json', () => {
    expect(() => parseGlobalFlags({ format: 'pretty', json: true })).toThrow(CliStructuredError);
    try {
      parseGlobalFlags({ format: 'pretty', json: true });
    } catch (error) {
      expect(CliStructuredError.is(error)).toBe(true);
      expect((error as CliStructuredError).code).toBe('CLI.OUTPUT_FORMAT_CONFLICT');
      expect((error as CliStructuredError).message).toMatch(/--format pretty.*--json/i);
    }
  });

  it('rejects unknown --format values with allowed values', () => {
    expect(() => parseGlobalFlags({ format: 'yaml' })).toThrow(CliStructuredError);
    try {
      parseGlobalFlags({ format: 'yaml' });
    } catch (error) {
      expect(CliStructuredError.is(error)).toBe(true);
      expect((error as CliStructuredError).code).toBe('CLI.INVALID_OUTPUT_FORMAT');
      expect((error as CliStructuredError).message).toMatch(/Invalid --format/i);
      expect((error as CliStructuredError).message).toMatch(/pretty.*json/i);
    }
  });

  it('disables color for json output', () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    const flags = parseGlobalFlags({ format: 'json' });
    expect(flags.color).toBe(false);
  });
});

describe('parseGlobalFlags structured format errors', () => {
  it('errorInvalidOutputFormat round-trips allowed values in meta', () => {
    const error = errorInvalidOutputFormat('yaml');
    expect(error.toEnvelope().code).toBe('CLI.INVALID_OUTPUT_FORMAT');
    expect(error.message).toContain('yaml');
    expect(error.message).toContain('pretty, json');
  });

  it('errorOutputFormatMutex round-trips CLI.OUTPUT_FORMAT_CONFLICT', () => {
    const error = errorOutputFormatMutex();
    expect(error.toEnvelope().code).toBe('CLI.OUTPUT_FORMAT_CONFLICT');
    expect(error.message).toMatch(/--format pretty.*--json/i);
  });
});

describe('parseGlobalFlagsOrExit', () => {
  const originalIsTTY = process.stdout.isTTY;
  const originalExit = process.exit;

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  it('emits structured error without stack trace for mutex conflict', async () => {
    const { parseGlobalFlagsOrExit } = await import('../../src/utils/global-flags');
    Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

    const stderrLines: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderrLines.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const exit = vi.fn(() => {
      throw new Error('process.exit called');
    }) as unknown as typeof process.exit;
    process.exit = exit;

    expect(() => parseGlobalFlagsOrExit({ format: 'pretty', json: true })).toThrow(
      'process.exit called',
    );

    expect(exit).toHaveBeenCalledWith(2);
    const stderr = stderrLines.join('');
    expect(stderr).toContain('CLI.OUTPUT_FORMAT_CONFLICT');
    expect(stderr).toMatch(/--format pretty.*--json/i);
    expect(stderr).not.toContain('at resolveOutputFormat');
  });
});

describe('deriveCanPrompt (interactive-prompt eligibility, single source of truth)', () => {
  it('returns false when stdin is closed even though stdout is a TTY (the canonical CI/agent shape)', () => {
    expect(
      deriveCanPrompt({ flagsInteractive: true, optionInteractive: undefined, stdinIsTTY: false }),
    ).toBe(false);
  });

  it('returns true when both streams are TTYs and no override is set', () => {
    expect(
      deriveCanPrompt({ flagsInteractive: true, optionInteractive: undefined, stdinIsTTY: true }),
    ).toBe(true);
  });

  it('honours an explicit --interactive override even when stdin is closed', () => {
    expect(
      deriveCanPrompt({ flagsInteractive: true, optionInteractive: true, stdinIsTTY: false }),
    ).toBe(true);
  });

  it('returns false when --no-interactive is set, regardless of stdin', () => {
    expect(
      deriveCanPrompt({ flagsInteractive: false, optionInteractive: undefined, stdinIsTTY: true }),
    ).toBe(false);
  });

  it('returns false in a fully piped environment (decoration off, stdin closed)', () => {
    expect(
      deriveCanPrompt({ flagsInteractive: false, optionInteractive: undefined, stdinIsTTY: false }),
    ).toBe(false);
  });
});
