import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PrismaNextConfig } from '@internal/config-loader';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import {
  contractSnapshotDir,
  writeContractSnapshot,
} from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { formatMigrationDirName, writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  writeRef: vi.fn(),
}));

vi.mock('@internal/migration-tools/refs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@internal/migration-tools/refs')>();
  return {
    ...actual,
    writeRef: mocks.writeRef,
  };
});

const HASH_A = `${'a'.repeat(64)}`;
const HASH_B = `${'b'.repeat(64)}`;
const HASH_C = `${'c'.repeat(64)}`;
const HASH_FLOAT = `${'f'.repeat(64)}`;
const PROFILE_HASH = `${'p'.repeat(64)}`;

function createTableOp(table: string): MigrationPlanOperation {
  return {
    id: `table.${table}`,
    label: `Create table "${table}"`,
    operationClass: 'additive',
  };
}

function contractJsonForHash(storageHash: string): unknown {
  return {
    schemaVersion: '1',
    targetFamily: 'sql',
    target: 'postgres',
    profileHash: PROFILE_HASH,
    storage: { storageHash },
    models: {
      User: {
        fields: {
          id: {
            nullable: false,
            type: { kind: 'scalar', codecId: 'sql/int4@1' },
          },
        },
        relations: {},
        storage: { namespaceId: '__unbound__', table: 'users', namespace: 'public' },
      },
    },
    roots: {},
  };
}

async function writeEndContract(migrationsRootDir: string, storageHash: string): Promise<void> {
  await writeContractSnapshot(migrationsRootDir, storageHash, {
    contractJson: contractJsonForHash(storageHash),
    contractDts: 'export type Contract = unknown;\n',
  });
}

async function writeAttestedMigration(
  migrationsRootDir: string,
  appMigrationsDir: string,
  opts: {
    from: string | null;
    to: string;
    ops: MigrationPlanOperation[];
    timestamp: Date;
    slug: string;
    withSnapshot?: boolean;
  },
): Promise<{ dirName: string; packageDir: string }> {
  const dirName = formatMigrationDirName(opts.timestamp, opts.slug);
  const packageDir = join(appMigrationsDir, dirName);
  const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
    from: opts.from,
    to: opts.to,
    providedInvariants: [],
    createdAt: opts.timestamp.toISOString(),
  };
  const migrationHash = computeMigrationHash(baseMetadata, opts.ops);
  const metadata: MigrationMetadata = { ...baseMetadata, migrationHash };
  await writeMigrationPackage(packageDir, metadata, opts.ops);
  if (opts.withSnapshot !== false) {
    await writeEndContract(migrationsRootDir, opts.to);
  }
  return { dirName, packageDir };
}

function refPointerPath(refsDir: string, name: string): string {
  return join(refsDir, `${name}.json`);
}

function storeContractJsonPath(migrationsRootDir: string, storageHash: string): string {
  return join(contractSnapshotDir(migrationsRootDir, storageHash), 'contract.json');
}

describe('ref commands', { timeout: timeouts.databaseOperation }, () => {
  let tempDir: string;
  let configPath: string;
  let config: PrismaNextConfig;
  let migrationsRootDir: string;
  let appMigrationsDir: string;
  let refsDir: string;

  function refOptions() {
    return { config, cwd: tempDir, configPath };
  }

  beforeEach(async () => {
    mocks.writeRef.mockReset();
    const { writeRef: realWriteRef } = await vi.importActual<
      typeof import('@internal/migration-tools/refs')
    >('@internal/migration-tools/refs');
    mocks.writeRef.mockImplementation(realWriteRef);

    tempDir = join(tmpdir(), `ref-cmd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    migrationsRootDir = join(tempDir, 'migrations');
    appMigrationsDir = join(migrationsRootDir, 'app');
    refsDir = join(appMigrationsDir, 'refs');
    await mkdir(refsDir, { recursive: true });
    configPath = join(tempDir, 'prisma-next.config.ts');
    await writeFile(
      join(tempDir, 'contract.json'),
      JSON.stringify({
        storage: { storageHash: HASH_A },
        schemaVersion: '1.0.0',
        target: 'postgres',
        targetFamily: 'sql',
      }),
    );
    config = {
      family: {
        familyId: 'sql',
        create: vi.fn().mockReturnValue({
          deserializeContract: (json: unknown) => json,
        }),
      },
      target: {
        id: 'postgres',
        familyId: 'sql',
        targetId: 'postgres',
        kind: 'target',
        migrations: {},
      },
      contract: { output: join(tempDir, 'contract.json') },
      migrations: { dir: 'migrations' },
    } as unknown as PrismaNextConfig;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function seedLinearGraph(): Promise<{
    hashA: string;
    hashB: string;
    hashC: string;
    firstDirName: string;
    secondDirName: string;
  }> {
    const first = await writeAttestedMigration(migrationsRootDir, appMigrationsDir, {
      from: null,
      to: HASH_A,
      ops: [createTableOp('user')],
      timestamp: new Date(2026, 0, 1, 10, 0),
      slug: 'add_user',
    });
    const second = await writeAttestedMigration(migrationsRootDir, appMigrationsDir, {
      from: HASH_A,
      to: HASH_B,
      ops: [createTableOp('post')],
      timestamp: new Date(2026, 0, 2, 10, 0),
      slug: 'add_post',
    });
    await writeAttestedMigration(migrationsRootDir, appMigrationsDir, {
      from: HASH_B,
      to: HASH_C,
      ops: [createTableOp('comment')],
      timestamp: new Date(2026, 0, 3, 10, 0),
      slug: 'add_comment',
    });
    return {
      hashA: HASH_A,
      hashB: HASH_B,
      hashC: HASH_C,
      firstDirName: first.dirName,
      secondDirName: second.dirName,
    };
  }

  it('sets a ref to a graph-node hash, writing only the pointer', async () => {
    const { hashB } = await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('staging', hashB, refOptions());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hash).toBe(hashB);
      expect(existsSync(refPointerPath(refsDir, 'staging'))).toBe(true);
      expect(existsSync(storeContractJsonPath(migrationsRootDir, hashB))).toBe(true);
    } finally {
      process.chdir(prev);
    }
  });

  it('refuses a hash that is not a graph node', async () => {
    await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('staging', HASH_FLOAT, refOptions());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const envelope = result.failure.toEnvelope();
      expect(envelope.code).toBe('MIGRATION.HASH_NOT_IN_GRAPH');
      expect(envelope.meta?.['resolvedHash']).toBe(HASH_FLOAT);
      expect(envelope.meta?.['reachableHashes']).toEqual(
        expect.arrayContaining([HASH_A, HASH_B, HASH_C]),
      );
    } finally {
      process.chdir(prev);
    }
  });

  it('refuses when the migration graph is empty', async () => {
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('staging', HASH_A, refOptions());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const envelope = result.failure.toEnvelope();
      expect(envelope.code).toBe('MIGRATION.HASH_NOT_IN_GRAPH');
      expect(envelope.why).toContain('empty');
      expect(envelope.fix).toContain('migration plan');
    } finally {
      process.chdir(prev);
    }
  });

  it('refuses the empty-database sentinel hash', async () => {
    await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('staging', EMPTY_CONTRACT_HASH, refOptions());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      const envelope = result.failure.toEnvelope();
      expect(envelope.code).toBe('MIGRATION.REF_SET_EMPTY_SENTINEL');
    } finally {
      process.chdir(prev);
    }
  });

  it('resolves another ref name and writes only the pointer', async () => {
    const { hashC } = await seedLinearGraph();
    await writeRef(refsDir, 'production', { hash: hashC, invariants: [] });
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('staging', 'production', refOptions());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hash).toBe(hashC);
      expect(existsSync(refPointerPath(refsDir, 'staging'))).toBe(true);
    } finally {
      process.chdir(prev);
    }
  });

  it('resolves a migration bundle directory to its destination hash', async () => {
    const { hashA, firstDirName } = await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('staging', firstDirName, refOptions());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hash).toBe(hashA);
    } finally {
      process.chdir(prev);
    }
  });

  it('resolves a migration bundle directory with ^ to its source hash', async () => {
    const { hashA, secondDirName } = await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('staging', `${secondDirName}^`, refOptions());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hash).toBe(hashA);
    } finally {
      process.chdir(prev);
    }
  });

  it('refuses an invalid ref name', async () => {
    await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('../evil', HASH_A, refOptions());
      expect(result.ok).toBe(false);
    } finally {
      process.chdir(prev);
    }
  });

  it('overwrites an existing ref pointer', async () => {
    const { hashA, hashB } = await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const first = await executeRefSetCommand('staging', hashA, refOptions());
      expect(first.ok).toBe(true);
      const second = await executeRefSetCommand('staging', hashB, refOptions());
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      const pointer = JSON.parse(await readFile(refPointerPath(refsDir, 'staging'), 'utf-8'));
      expect(pointer.hash).toBe(hashB);
    } finally {
      process.chdir(prev);
    }
  });

  it('refuses when the matching bundle has no contract snapshot in the store', async () => {
    await writeAttestedMigration(migrationsRootDir, appMigrationsDir, {
      from: null,
      to: HASH_A,
      ops: [createTableOp('user')],
      timestamp: new Date(2026, 0, 1, 10, 0),
      slug: 'add_user',
      withSnapshot: false,
    });
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('staging', HASH_A, refOptions());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.toEnvelope().summary).toContain('File not found');
    } finally {
      process.chdir(prev);
    }
  });

  it('does not write a pointer when the pointer write fails', async () => {
    const { hashA } = await seedLinearGraph();
    mocks.writeRef.mockRejectedValueOnce(new Error('simulated writeRef failure'));
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefSetCommand('staging', hashA, refOptions());
      expect(result.ok).toBe(false);
      expect(existsSync(refPointerPath(refsDir, 'staging'))).toBe(false);
    } finally {
      process.chdir(prev);
    }
  });

  it('deletes only the pointer, leaving the store entry', async () => {
    const { hashA } = await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand, executeRefDeleteCommand } = await import(
        '../../src/control-api/operations/ref'
      );
      await executeRefSetCommand('staging', hashA, refOptions());
      const result = await executeRefDeleteCommand('staging', refOptions());
      expect(result.ok).toBe(true);
      expect(existsSync(refPointerPath(refsDir, 'staging'))).toBe(false);
      expect(existsSync(storeContractJsonPath(migrationsRootDir, hashA))).toBe(true);
    } finally {
      process.chdir(prev);
    }
  });

  it('deletes the db ref without special casing', async () => {
    const { hashA } = await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand, executeRefDeleteCommand } = await import(
        '../../src/control-api/operations/ref'
      );
      await executeRefSetCommand('db', hashA, refOptions());
      const result = await executeRefDeleteCommand('db', refOptions());
      expect(result.ok).toBe(true);
    } finally {
      process.chdir(prev);
    }
  });

  it('refuses delete for an unknown ref', async () => {
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefDeleteCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefDeleteCommand('missing', refOptions());
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.failure.toEnvelope().code).toBe('MIGRATION.UNKNOWN_REF');
    } finally {
      process.chdir(prev);
    }
  });

  it('refuses delete for an invalid ref name', async () => {
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefDeleteCommand } = await import('../../src/control-api/operations/ref');
      const result = await executeRefDeleteCommand('bad/name', refOptions());
      expect(result.ok).toBe(false);
    } finally {
      process.chdir(prev);
    }
  });

  it('lists refs by pointer file', async () => {
    const { hashA, hashB } = await seedLinearGraph();
    const prev = process.cwd();
    process.chdir(tempDir);
    try {
      const { executeRefSetCommand, executeRefListCommand } = await import(
        '../../src/control-api/operations/ref'
      );
      await executeRefSetCommand('db', hashA, refOptions());
      await executeRefSetCommand('staging', hashB, refOptions());
      const result = await executeRefListCommand(refOptions());
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(Object.keys(result.value.refs).sort()).toEqual(['db', 'staging']);
    } finally {
      process.chdir(prev);
    }
  });
});
