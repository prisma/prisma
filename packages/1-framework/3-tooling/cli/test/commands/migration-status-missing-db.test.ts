import type { CliErrorEnvelope } from '@internal/errors/control';
import { ok } from '@internal/utils/result';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

const baseConfig = {
  family: { familyId: 'sql', create: vi.fn() },
  target: { id: 'postgres', familyId: 'sql', targetId: 'postgres', kind: 'target', migrations: {} },
  adapter: { kind: 'adapter', familyId: 'sql', targetId: 'postgres' },
  driver: { kind: 'driver' },
  db: { connection: 'postgres://localhost/test' },
  contract: { output: 'contract.json' },
  migrations: { dir: 'migrations' },
};

function firstJsonLine<T>(consoleOutput: readonly string[]): T {
  const line = consoleOutput.find((l) => l.trimStart().startsWith('{'));
  if (!line) {
    throw new Error(`Expected a JSON object on stdout; got:\n${consoleOutput.join('\n')}`);
  }
  return JSON.parse(line) as T;
}

async function runAndCaptureExit(invoke: () => Promise<number>): Promise<number> {
  try {
    return await invoke();
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'process.exit called') {
      throw error;
    }
    return getExitCode() ?? 0;
  }
}

describe('migration status missing-DB precondition', () => {
  let consoleOutput: string[];
  let cleanup: () => void;

  beforeEach(() => {
    vi.resetModules();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    cleanup = commandMocks.cleanup;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Repo-wide vitest runs with `isolate: false`, so the `vi.mock` leaks
    // into the next file in the same worker; unmock to restore it.
    vi.doUnmock('@internal/config-loader');
    vi.resetModules();
  });

  it('emits the shared missing-DB envelope with meta.missingFlags when no db and no --from', async () => {
    mocks.loadConfig.mockResolvedValue(ok({ ...baseConfig, db: {} }));

    const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
    await runAndCaptureExit(() => executeCommand(createMigrationStatusCommand(), ['--json']));
    const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

    expect(envelope.code).toBe('CONFIG.DB_CONNECTION_REQUIRED');
    expect(envelope.meta?.['missingFlags']).toEqual(['--db']);
  });

  it('uses the same envelope when only the driver is missing', async () => {
    mocks.loadConfig.mockResolvedValue(ok({ ...baseConfig, driver: undefined }));

    const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
    await runAndCaptureExit(() =>
      executeCommand(createMigrationStatusCommand(), [
        '--json',
        '--db',
        'postgres://localhost/test',
      ]),
    );
    const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

    expect(envelope.code).toBe('CONFIG.DB_CONNECTION_REQUIRED');
    expect(envelope.meta?.['missingFlags']).toEqual([]);
  });
});
