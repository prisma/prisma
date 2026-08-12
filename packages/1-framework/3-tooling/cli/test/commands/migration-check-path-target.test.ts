import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { join } from 'pathe';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, getExitCode, setupCommandMocks } from '../utils/test-helpers';

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
}));

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfig,
}));

const TARGET = 'mock';
const TARGET_FAMILY = 'mock';
const HASH = `${'a'.repeat(64)}`;

const ADDITIVE_OPS: readonly MigrationPlanOperation[] = [
  { id: 'table.users', label: 'Create table users', operationClass: 'additive' },
];

function baseConfig(): Record<string, unknown> {
  return {
    family: {
      familyId: TARGET_FAMILY,
      create: vi.fn().mockReturnValue({
        deserializeContract: (json: unknown) => json,
      }),
    },
    target: {
      id: TARGET,
      familyId: TARGET_FAMILY,
      targetId: TARGET,
      kind: 'target',
      migrations: {},
    },
    adapter: { kind: 'adapter', familyId: TARGET_FAMILY, targetId: TARGET },
    driver: { kind: 'driver' },
    db: { connection: 'postgres://localhost/check-path-test' },
    contract: { output: 'src/prisma/contract.json' },
  };
}

async function writeFixture(): Promise<{ cwd: string; dirPath: string }> {
  const cwd = realpathSync(await mkdtemp(join(tmpdir(), 'check-path-target-')));
  const appDir = join(cwd, 'migrations', 'app');
  const metadataBase: Omit<MigrationMetadata, 'migrationHash'> = {
    from: null,
    to: HASH,
    providedInvariants: [],
    createdAt: '2026-02-25T14:30:00.000Z',
  };
  const metadata: MigrationMetadata = {
    ...metadataBase,
    migrationHash: computeMigrationHash(metadataBase, ADDITIVE_OPS),
  };
  const dirPath = join(appDir, '00001_init');
  await writeMigrationPackage(dirPath, metadata, ADDITIVE_OPS);
  const contractDir = join(cwd, 'src', 'prisma');
  await mkdir(contractDir, { recursive: true });
  await writeFile(
    join(contractDir, 'contract.json'),
    JSON.stringify({
      storage: { storageHash: HASH, namespaces: {} },
      schemaVersion: '1.0.0',
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );
  return { cwd, dirPath };
}

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

interface CheckResultEnvelope {
  readonly ok: boolean;
  readonly failures: readonly unknown[];
  readonly summary: string;
}

describe('migration check path target', () => {
  let consoleOutput: string[];
  let cleanup: () => void;
  const originalCwd = process.cwd();
  let tempDir: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    cleanup = commandMocks.cleanup;
    mocks.loadConfig.mockResolvedValue(ok(baseConfig()));
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    cleanup();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.doUnmock('@internal/config-loader');
    vi.resetModules();
  });

  it('resolves and checks a migration directory path', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    const fixture = await writeFixture();
    tempDir = fixture.cwd;
    process.chdir(fixture.cwd);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), [fixture.dirPath, '--json']),
    );
    const result = firstJsonLine<CheckResultEnvelope>(consoleOutput);

    expect(exitCode).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('rejects a path outside the app migrations dir', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    const fixture = await writeFixture();
    tempDir = fixture.cwd;
    process.chdir(fixture.cwd);

    const outside = join(fixture.cwd, 'migrations', 'cipherstash', '00001-init');
    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), [outside, '--json']),
    );

    expect(exitCode).toBe(2);
  });
});
