import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as configLoader from '@internal/config-loader';
import type { Contract } from '@internal/contract/types';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { createSqlContract } from '@repo/test-utils';
import { join } from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, setupCommandMocks } from '../utils/test-helpers';

vi.mock('@internal/config-loader', { spy: true });

const HASH_ROOT = `4cb4256${'0'.repeat(57)}`;

const ADDITIVE_OP: MigrationPlanOperation = {
  id: 'table.users',
  label: 'Create table users',
  operationClass: 'additive',
};

const TEST_APP_CONTRACT = createSqlContract({
  target: 'postgres',
  storage: {
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: {
        id: UNBOUND_NAMESPACE_ID,
        entries: { table: { user: { columns: { id: {} } } } },
      },
    },
  },
});

const identityDeserialize = (json: unknown): Contract => json as Contract;

async function writePackage(migrationsRoot: string, dirName: string): Promise<void> {
  const pkgDir = join(migrationsRoot, 'app', dirName);
  const ops = [ADDITIVE_OP];
  const baseMetadata = {
    from: null,
    to: HASH_ROOT,
    providedInvariants: [] as readonly string[],
    createdAt: '2026-02-25T14:30:00.000Z',
  } as Omit<MigrationMetadata, 'migrationHash'>;
  const metadata: MigrationMetadata = {
    ...baseMetadata,
    migrationHash: computeMigrationHash(baseMetadata, ops),
  };
  await writeMigrationPackage(pkgDir, metadata, ops);
}

async function buildFixture(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'migration-legend-cmd-'));
  const migrationsDir = join(cwd, 'migrations');
  const contractDir = join(cwd, 'src', 'prisma');
  await mkdir(contractDir, { recursive: true });
  await writeFile(
    join(contractDir, 'contract.json'),
    JSON.stringify({
      storage: { storageHash: TEST_APP_CONTRACT.storage.storageHash, namespaces: {} },
      schemaVersion: '1.0.0',
      target: 'postgres',
      targetFamily: 'sql',
    }),
  );
  await mkdir(join(migrationsDir, 'app'), { recursive: true });
  await writePackage(migrationsDir, '20260422T0720_initial');
  return cwd;
}

function mockConfig(): void {
  vi.spyOn(configLoader, 'loadConfigForSections').mockResolvedValue(
    ok({
      family: {
        familyId: 'sql',
        create: vi.fn().mockReturnValue({
          deserializeContract: identityDeserialize,
        }),
      },
      target: {
        id: 'postgres',
        familyId: 'sql',
        targetId: 'postgres',
        kind: 'target',
      },
      adapter: { kind: 'adapter', familyId: 'sql', targetId: 'postgres' },
      driver: { kind: 'driver' },
      contract: { output: 'src/prisma/contract.json', source: 'src/prisma/contract.json' },
      migrations: { dir: 'migrations' },
      extensions: [],
    } as unknown as configLoader.PrismaNextConfig),
  );
}

function envelopeCode(consoleOutput: readonly string[]): string | undefined {
  const jsonLine = consoleOutput.find((line) => line.trimStart().startsWith('{'));
  if (jsonLine === undefined) {
    return undefined;
  }
  const envelope = JSON.parse(jsonLine) as { code?: string };
  return envelope.code;
}

const createdDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  const dirs = createdDirs.splice(0);
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('migration list --legend', () => {
  it('prints the key on stderr', async () => {
    const commandMocks = setupCommandMocks();
    mockConfig();
    const cwd = await buildFixture();
    createdDirs.push(cwd);
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { createMigrationListCommand } = await import('../../src/commands/migration-list');
      const exitCode = await executeCommand(createMigrationListCommand(), [
        '--legend',
        '--no-color',
      ]);
      expect(exitCode).toBe(0);
      const stderr = commandMocks.consoleErrors.join('\n');
      expect(stderr).toContain('Legend:');
      expect(stderr).toContain('@contract @db');
      expect(stderr).toContain('(prod, staging)');
      expect(stderr).toContain('reserved markers — also typeable as --from/--to tokens');
    } finally {
      process.chdir(originalCwd);
      commandMocks.cleanup();
    }
  });

  it('returns MIGRATION.LEGEND_HUMAN_ONLY with --json', async () => {
    const commandMocks = setupCommandMocks({ isTTY: false });
    mockConfig();
    const cwd = await buildFixture();
    createdDirs.push(cwd);
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { createMigrationListCommand } = await import('../../src/commands/migration-list');
      await expect(
        executeCommand(createMigrationListCommand(), ['--legend', '--json']),
      ).rejects.toThrow('process.exit called');
      expect(envelopeCode(commandMocks.consoleOutput)).toBe('MIGRATION.LEGEND_HUMAN_ONLY');
    } finally {
      process.chdir(originalCwd);
      commandMocks.cleanup();
    }
  });

  it('returns MIGRATION.LEGEND_HUMAN_ONLY with --quiet', async () => {
    const commandMocks = setupCommandMocks({ isTTY: false });
    mockConfig();
    const cwd = await buildFixture();
    createdDirs.push(cwd);
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { createMigrationListCommand } = await import('../../src/commands/migration-list');
      await expect(
        executeCommand(createMigrationListCommand(), ['--legend', '--quiet']),
      ).rejects.toThrow('process.exit called');
      expect(envelopeCode(commandMocks.consoleOutput)).toBe('MIGRATION.LEGEND_HUMAN_ONLY');
    } finally {
      process.chdir(originalCwd);
      commandMocks.cleanup();
    }
  });

  it('prints the legend with --space app', async () => {
    const commandMocks = setupCommandMocks();
    mockConfig();
    const cwd = await buildFixture();
    createdDirs.push(cwd);
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { createMigrationListCommand } = await import('../../src/commands/migration-list');
      const exitCode = await executeCommand(createMigrationListCommand(), [
        '--legend',
        '--space',
        'app',
        '--no-color',
      ]);
      expect(exitCode).toBe(0);
      expect(commandMocks.consoleErrors.join('\n')).toContain('Legend:');
    } finally {
      process.chdir(originalCwd);
      commandMocks.cleanup();
    }
  });
});

describe('migration status --legend', () => {
  it('prints the key on stderr', async () => {
    const commandMocks = setupCommandMocks();
    mockConfig();
    const cwd = await buildFixture();
    createdDirs.push(cwd);
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
      const exitCode = await executeCommand(createMigrationStatusCommand(), [
        '--legend',
        '--from',
        EMPTY_CONTRACT_HASH,
        '--no-color',
      ]);
      expect(exitCode).toBe(0);
      const stderr = commandMocks.consoleErrors.join('\n');
      expect(stderr).toContain('Legend:');
      expect(stderr).toContain('user-defined refs');
    } finally {
      process.chdir(originalCwd);
      commandMocks.cleanup();
    }
  });

  it('returns MIGRATION.LEGEND_HUMAN_ONLY with --json', async () => {
    const commandMocks = setupCommandMocks({ isTTY: false });
    mockConfig();
    const cwd = await buildFixture();
    createdDirs.push(cwd);
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
      await expect(
        executeCommand(createMigrationStatusCommand(), [
          '--legend',
          '--from',
          EMPTY_CONTRACT_HASH,
          '--json',
        ]),
      ).rejects.toThrow('process.exit called');
      expect(envelopeCode(commandMocks.consoleOutput)).toBe('MIGRATION.LEGEND_HUMAN_ONLY');
    } finally {
      process.chdir(originalCwd);
      commandMocks.cleanup();
    }
  });

  it('returns MIGRATION.LEGEND_HUMAN_ONLY with --quiet', async () => {
    const commandMocks = setupCommandMocks({ isTTY: false });
    mockConfig();
    const cwd = await buildFixture();
    createdDirs.push(cwd);
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
      await expect(
        executeCommand(createMigrationStatusCommand(), [
          '--legend',
          '--from',
          EMPTY_CONTRACT_HASH,
          '--quiet',
        ]),
      ).rejects.toThrow('process.exit called');
      expect(envelopeCode(commandMocks.consoleOutput)).toBe('MIGRATION.LEGEND_HUMAN_ONLY');
    } finally {
      process.chdir(originalCwd);
      commandMocks.cleanup();
    }
  });

  it('prints the legend with --space app', async () => {
    const commandMocks = setupCommandMocks();
    mockConfig();
    const cwd = await buildFixture();
    createdDirs.push(cwd);
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
      const exitCode = await executeCommand(createMigrationStatusCommand(), [
        '--legend',
        '--from',
        EMPTY_CONTRACT_HASH,
        '--space',
        'app',
        '--no-color',
      ]);
      expect(exitCode).toBe(0);
      expect(commandMocks.consoleErrors.join('\n')).toContain('Legend:');
    } finally {
      process.chdir(originalCwd);
      commandMocks.cleanup();
    }
  });
});

describe('migration status --ascii', () => {
  it('renders the tree with ASCII glyphs', async () => {
    const commandMocks = setupCommandMocks();
    mockConfig();
    const cwd = await buildFixture();
    createdDirs.push(cwd);
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      const { createMigrationStatusCommand } = await import('../../src/commands/migration-status');
      const exitCode = await executeCommand(createMigrationStatusCommand(), [
        '--ascii',
        '--from',
        EMPTY_CONTRACT_HASH,
        '--no-color',
      ]);
      expect(exitCode).toBe(0);
      const stdout = commandMocks.consoleOutput.join('\n');
      const migrationLine = stdout
        .split('\n')
        .find((line) => line.includes('20260422T0720_initial'));
      expect(migrationLine).toBeDefined();
      expect(migrationLine).toContain('|^');
      expect(migrationLine).toContain('- -> 4cb4256');
      expect(migrationLine).not.toContain('│↑');
      expect(migrationLine).not.toContain('→');
    } finally {
      process.chdir(originalCwd);
      commandMocks.cleanup();
    }
  });
});
