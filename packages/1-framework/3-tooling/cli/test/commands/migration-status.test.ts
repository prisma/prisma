import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as configLoader from '@internal/config-loader';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { formatMigrationDirName, writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { ok } from '@internal/utils/result';
import { type } from 'arktype';
import { join } from 'pathe';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  type MigrationStatusResult,
  migrationStatusJsonResultSchema,
} from '../../src/commands/json/schemas';
import {
  executeMigrationStatusCommand,
  type MigrationStatusOptions,
} from '../../src/commands/migration-status';
import { parseGlobalFlags } from '../../src/utils/global-flags';
import { createTerminalUI } from '../../src/utils/terminal-ui';

vi.mock('@internal/config-loader', { spy: true });

const mocks = vi.hoisted(() => ({
  readAllMarkers: vi.fn(),
  readLedger: vi.fn(),
  connect: vi.fn(),
  close: vi.fn(),
}));

vi.mock('../../src/control-api/client', () => ({
  createControlClient: vi.fn(() => ({
    connect: mocks.connect,
    readAllMarkers: mocks.readAllMarkers,
    readLedger: mocks.readLedger,
    close: mocks.close,
  })),
}));

const TARGET = 'postgres';
const TARGET_FAMILY = 'sql';
const HASH_A = `${'a'.repeat(64)}`;
const HASH_B = `${'b'.repeat(64)}`;

const ADDITIVE_OP: MigrationPlanOperation = {
  id: 'table.users',
  label: 'Create users',
  operationClass: 'additive',
};

const createdDirs: string[] = [];

function baseConfig(contractOutput: string) {
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
    db: { connection: 'postgres://localhost/migration-status-golden' },
    contract: { output: contractOutput },
    migrations: { dir: 'migrations' },
  };
}

async function writeContract(cwd: string, storageHash: string): Promise<string> {
  const contractPath = join(cwd, 'contract.json');
  await writeFile(
    contractPath,
    JSON.stringify({
      storage: { storageHash },
      schemaVersion: '1.0.0',
      target: TARGET,
      targetFamily: TARGET_FAMILY,
    }),
  );
  return contractPath;
}

async function writeLinearMigrations(
  migrationsRoot: string,
): Promise<{ dirInit: string; dirNext: string }> {
  const appDir = join(migrationsRoot, 'app');
  await mkdir(appDir, { recursive: true });

  const writePkg = async (
    slug: string,
    from: string | null,
    to: string,
    date: Date,
  ): Promise<string> => {
    const dirName = formatMigrationDirName(date, slug);
    const metadataBase: Omit<MigrationMetadata, 'migrationHash'> = {
      from,
      to,
      providedInvariants: [],
      createdAt: date.toISOString(),
    };
    const metadata: MigrationMetadata = {
      ...metadataBase,
      migrationHash: computeMigrationHash(metadataBase, [ADDITIVE_OP]),
    };
    await writeMigrationPackage(join(appDir, dirName), metadata, [ADDITIVE_OP]);
    return dirName;
  };

  const dirInit = await writePkg('init', null, HASH_A, new Date('2026-01-01T10:00:00Z'));
  const dirNext = await writePkg('add_users', HASH_A, HASH_B, new Date('2026-01-02T10:00:00Z'));
  return { dirInit, dirNext };
}

describe('migration status --json golden', () => {
  afterAll(() => {
    vi.doUnmock('../../src/control-api/client');
    vi.doUnmock('@internal/config-loader');
  });

  afterEach(async () => {
    await Promise.all(createdDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    createdDirs.length = 0;
    vi.restoreAllMocks();
  });

  it('validates against migrationStatusJsonResultSchema for all-pending case', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'status-json-golden-'));
    createdDirs.push(cwd);
    const contractPath = await writeContract(cwd, HASH_B);
    const { dirInit, dirNext } = await writeLinearMigrations(join(cwd, 'migrations'));
    vi.spyOn(configLoader, 'loadConfigForSections').mockResolvedValue(
      ok(baseConfig(contractPath) as unknown as configLoader.PrismaNextConfig),
    );

    mocks.connect.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: EMPTY_CONTRACT_HASH }]]),
    );
    mocks.readLedger.mockResolvedValue([]);

    const options: MigrationStatusOptions = { config: contractPath };
    const flags = parseGlobalFlags({ json: true, quiet: true });
    const ui = createTerminalUI(flags);
    const result = await executeMigrationStatusCommand(options, flags, ui);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const jsonResult: MigrationStatusResult = {
      ok: true,
      spaces: [...result.value.spaces],
      summary: result.value.summary,
      diagnostics: [...result.value.diagnostics],
    };

    expect(migrationStatusJsonResultSchema(jsonResult) instanceof type.errors).toBe(false);

    const { spaces } = jsonResult;
    expect(spaces).toHaveLength(1);
    const appSpace = spaces[0]!;
    expect(appSpace.space).toBe('app');
    expect(appSpace.currentContract).toBe(EMPTY_CONTRACT_HASH);
    expect(appSpace.targetContract).toBe(HASH_B);
    expect(appSpace.migrations).toHaveLength(2);

    const initMig = appSpace.migrations.find((m) => m.name === dirInit);
    expect(initMig).toBeDefined();
    expect(initMig?.fromContract).toBeNull();
    expect(initMig?.toContract).toBe(HASH_A);
    expect(initMig?.status).toBe('pending');

    const nextMig = appSpace.migrations.find((m) => m.name === dirNext);
    expect(nextMig?.fromContract).toBe(HASH_A);
    expect(nextMig?.status).toBe('pending');

    expect(jsonResult.diagnostics).toHaveLength(0);
  });

  it('sets fromContract to null at the empty start, not the sentinel hash', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'status-json-empty-start-'));
    createdDirs.push(cwd);
    const contractPath = await writeContract(cwd, HASH_A);
    const appDir = join(cwd, 'migrations', 'app');
    await mkdir(appDir, { recursive: true });
    const metadataBase: Omit<MigrationMetadata, 'migrationHash'> = {
      from: null,
      to: HASH_A,
      providedInvariants: [],
      createdAt: '2026-01-01T10:00:00.000Z',
    };
    const metadata: MigrationMetadata = {
      ...metadataBase,
      migrationHash: computeMigrationHash(metadataBase, [ADDITIVE_OP]),
    };
    await writeMigrationPackage(
      join(appDir, formatMigrationDirName(new Date('2026-01-01T10:00:00Z'), 'init')),
      metadata,
      [ADDITIVE_OP],
    );
    vi.spyOn(configLoader, 'loadConfigForSections').mockResolvedValue(
      ok(baseConfig(contractPath) as unknown as configLoader.PrismaNextConfig),
    );

    mocks.connect.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
    mocks.readAllMarkers.mockResolvedValue(
      new Map([['app', { storageHash: EMPTY_CONTRACT_HASH }]]),
    );
    mocks.readLedger.mockResolvedValue([]);

    const options: MigrationStatusOptions = { config: contractPath };
    const flags = parseGlobalFlags({ json: true, quiet: true });
    const ui = createTerminalUI(flags);
    const result = await executeMigrationStatusCommand(options, flags, ui);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const firstMig = result.value.spaces[0]?.migrations[0];
    expect(firstMig?.fromContract).toBeNull();
    expect(firstMig?.fromContract).not.toBe(EMPTY_CONTRACT_HASH);
  });

  it('includes structured CONTRACT.UNREADABLE diagnostic when contract is missing', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'status-json-diag-'));
    createdDirs.push(cwd);
    const missingPath = join(cwd, 'missing-contract.json');
    const appDir = join(cwd, 'migrations', 'app');
    await mkdir(appDir, { recursive: true });
    const metadataBase: Omit<MigrationMetadata, 'migrationHash'> = {
      from: null,
      to: HASH_A,
      providedInvariants: [],
      createdAt: '2026-01-01T10:00:00.000Z',
    };
    const metadata: MigrationMetadata = {
      ...metadataBase,
      migrationHash: computeMigrationHash(metadataBase, [ADDITIVE_OP]),
    };
    await writeMigrationPackage(
      join(appDir, formatMigrationDirName(new Date('2026-01-01T10:00:00Z'), 'init')),
      metadata,
      [ADDITIVE_OP],
    );
    vi.spyOn(configLoader, 'loadConfigForSections').mockResolvedValue(
      ok({
        ...baseConfig(missingPath),
        db: undefined,
      } as unknown as configLoader.PrismaNextConfig),
    );

    const options: MigrationStatusOptions = { config: missingPath, from: EMPTY_CONTRACT_HASH };
    const flags = parseGlobalFlags({ json: true, quiet: true });
    const ui = createTerminalUI(flags);
    const result = await executeMigrationStatusCommand(options, flags, ui);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const diag = result.value.diagnostics.find((d) => d.code === 'CONTRACT.UNREADABLE');
    expect(diag).toBeDefined();
    expect(diag?.code).toBe('CONTRACT.UNREADABLE');
    expect(typeof diag?.message).toBe('string');
  });
});
