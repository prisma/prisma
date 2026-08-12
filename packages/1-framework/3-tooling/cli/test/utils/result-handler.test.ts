import { notOk, ok } from '@internal/utils/result';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CliStructuredError,
  errorConfigFileNotFound,
  errorMarkerMissing,
} from '../../src/utils/cli-errors';
import type { GlobalFlags } from '../../src/utils/global-flags';
import { handleResult } from '../../src/utils/result-handler';
import { TerminalUI } from '../../src/utils/terminal-ui';

function defaultTestFlags(overrides: Partial<GlobalFlags> = {}): GlobalFlags {
  return {
    format: 'pretty',
    explicitFormat: false,
    quiet: false,
    verbose: 0,
    color: false,
    interactive: true,
    ...overrides,
  };
}

function createUI(flags?: Partial<GlobalFlags>) {
  const resolved = defaultTestFlags(flags);
  return new TerminalUI({
    color: false,
    interactive: !resolved.json,
    forcePretty: resolved.format === 'pretty' && resolved.explicitFormat,
  });
}

describe('result handler', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
  });

  it('returns 0 for successful result', () => {
    const result = ok('success');
    const exitCode = handleResult(result, defaultTestFlags(), createUI());
    expect(exitCode).toBe(0);
  });

  it('calls onSuccess callback for successful result', () => {
    const result = ok('success');
    const onSuccess = vi.fn();
    const exitCode = handleResult(result, defaultTestFlags(), createUI(), onSuccess);
    expect(exitCode).toBe(0);
    expect(onSuccess).toHaveBeenCalledWith('success');
  });

  it('returns exit code 2 for a precondition failure', () => {
    const error = errorConfigFileNotFound();
    const result = notOk(error);
    const exitCode = handleResult(result, defaultTestFlags(), createUI());
    expect(exitCode).toBe(2);
  });

  it('returns exit code 2 for any other expected failure', () => {
    const error = errorMarkerMissing();
    const result = notOk(error);
    const exitCode = handleResult(result, defaultTestFlags(), createUI());
    expect(exitCode).toBe(2);
  });

  it('returns exit code 3 for a user-declined prompt', () => {
    const error = new CliStructuredError('CLI.INIT_USER_ABORTED', 'Init cancelled');
    const result = notOk(error);
    const exitCode = handleResult(result, defaultTestFlags(), createUI());
    expect(exitCode).toBe(3);
  });

  it('writes JSON error to stdout when json flag is set', () => {
    const error = errorConfigFileNotFound();
    const result = notOk(error);
    handleResult(
      result,
      defaultTestFlags({ format: 'json', json: true }),
      createUI({ format: 'json', json: true }),
    );

    // JSON data goes to stdout via ui.output()
    const stdoutCalls = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const jsonOutput = stdoutCalls.find((s: string) => s.includes('{'));
    expect(jsonOutput).toBeDefined();
    expect(() => JSON.parse(jsonOutput!.trim())).not.toThrow();
  });

  it('omits fix from JSON envelope when fix equals why', () => {
    const error = new CliStructuredError('CLI.UNEXPECTED', 'Unexpected error', {
      why: 'Same message',
      fix: 'Same message',
    });
    const result = notOk(error);

    handleResult(
      result,
      defaultTestFlags({ format: 'json', json: true }),
      createUI({ format: 'json', json: true }),
    );

    const stdoutCalls = stdoutSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    const jsonOutput = stdoutCalls.find((s: string) => s.includes('{'));
    expect(jsonOutput).toBeDefined();
    const envelope = JSON.parse(jsonOutput!.trim()) as { why?: string; fix?: string };
    expect(envelope.why).toBe('Same message');
    expect(envelope.fix).toBeUndefined();
  });

  it('writes error to stderr when json flag is not set', () => {
    const error = errorConfigFileNotFound();
    const result = notOk(error);
    handleResult(result, defaultTestFlags(), createUI());

    // Error goes to stderr via clack
    expect(stderrSpy).toHaveBeenCalled();
  });
});
