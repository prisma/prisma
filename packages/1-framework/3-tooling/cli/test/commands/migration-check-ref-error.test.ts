import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { CliErrorEnvelope } from '@internal/errors/control';
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
    db: { connection: 'postgres://localhost/check-ref-test' },
    contract: { output: 'src/prisma/contract.json' },
  };
}

async function writeFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'check-ref-error-'));
  const spaceDir = join(cwd, 'migrations', 'app');
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
  await writeMigrationPackage(join(spaceDir, '00001_init'), metadata, ADDITIVE_OPS);
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
  return cwd;
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

describe('migration check ref-resolution error', () => {
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

  it('emits the shared ref-resolution envelope (not inline strings) and exits PRECONDITION', async () => {
    const { createMigrationCheckCommand } = await import('../../src/commands/migration-check');
    tempDir = await writeFixture();
    process.chdir(tempDir);

    const exitCode = await runAndCaptureExit(() =>
      executeCommand(createMigrationCheckCommand(), ['does-not-exist', '--json']),
    );
    const envelope = firstJsonLine<CliErrorEnvelope>(consoleOutput);

    expect(exitCode).toBe(2);
    expect(envelope.ok).toBe(false);
    expect(envelope.code).toBe('MIGRATION.REF_NOT_FOUND');
    expect(envelope.meta?.['input']).toBe('does-not-exist');
    expect(envelope.meta?.['grammar']).toBe('migration');
  });
});
