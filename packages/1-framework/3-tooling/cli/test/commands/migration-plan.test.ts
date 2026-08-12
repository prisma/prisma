import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CliStructuredError } from '@internal/errors/control';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { MigrationToolsError } from '@internal/migration-tools/errors';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import {
  formatMigrationDirName,
  readMigrationPackage,
  readMigrationsDir,
  writeMigrationPackage,
} from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { findLeaf, reconstructGraph } from '@internal/migration-tools/migration-graph';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { resolveBundleByPrefix } from '../../src/commands/migration-plan';

function createTableOp(table: string): MigrationPlanOperation {
  return {
    id: `table.${table}`,
    label: `Create table "${table}"`,
    operationClass: 'additive',
  };
}

/**
 * Build attested metadata by computing `migrationHash` over the supplied
 * base metadata + ops. Mirrors the production `migration plan` flow which
 * always writes a fully-attested package.
 */
function attestedMetadata(
  base: Omit<MigrationMetadata, 'migrationHash'>,
  ops: readonly MigrationPlanOperation[],
): MigrationMetadata {
  return { ...base, migrationHash: computeMigrationHash(base, ops) };
}

/**
 * Canonical helper for writing a test migration package to disk. Always
 * produces a *consistent* (attested) package: the `migrationHash` is computed
 * over the exact `ops` passed to the writer, so the resulting package
 * round-trips through `readMigrationPackage`'s integrity check.
 *
 * Mirrors the `writeTestPackage` helper in
 * `migration-tools/test/fixtures.ts` and `migration-e2e.test.ts`. The
 * cross-package consolidation into a published
 * `@internal/migration-tools/testing` subpath is queued as a follow-up.
 */
async function writeTestPackage(
  dir: string,
  base: Omit<MigrationMetadata, 'migrationHash'>,
  ops: readonly MigrationPlanOperation[],
): Promise<MigrationMetadata> {
  const metadata = attestedMetadata(base, ops);
  await writeMigrationPackage(dir, metadata, ops);
  return metadata;
}

async function createTempDir(prefix: string): Promise<string> {
  const dir = join(
    tmpdir(),
    `test-migration-plan-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  return dir;
}

describe('migration plan — core flow', () => {
  it('writes a valid migration package for new project', async () => {
    const tempDir = await createTempDir('new-project');
    const migrationsDir = join(tempDir, 'migrations');
    await mkdir(migrationsDir, { recursive: true });

    const ops: MigrationPlanOperation[] = [createTableOp('user')];

    const dirName = formatMigrationDirName(new Date(), 'initial');
    const packageDir = join(migrationsDir, dirName);

    const metadata = await writeTestPackage(
      packageDir,
      {
        from: null,
        to: 'test-hash',
        providedInvariants: [],
        createdAt: new Date().toISOString(),
      },
      ops,
    );

    const pkg = await readMigrationPackage(packageDir, { migrationsDir });

    expect(pkg.metadata.from).toBeNull();
    expect(pkg.metadata.to).toBe('test-hash');
    expect(pkg.metadata.migrationHash).toBe(metadata.migrationHash);
    expect(pkg.ops).toHaveLength(1);
    expect(pkg.ops[0]!.id).toBe('table.user');
  });

  it('produces no-op when from and to hash match', async () => {
    const tempDir = await createTempDir('no-op');
    const migrationsDir = join(tempDir, 'migrations');
    await mkdir(migrationsDir, { recursive: true });

    const dirName = formatMigrationDirName(new Date(), 'first');
    const packageDir = join(migrationsDir, dirName);
    await writeTestPackage(
      packageDir,
      {
        from: null,
        to: 'same-hash',
        providedInvariants: [],
        createdAt: new Date().toISOString(),
      },
      [],
    );

    // Read migrations and find leaf — leaf should be 'same-hash'
    const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
    const graph = reconstructGraph(packages);
    const leaf = findLeaf(graph);

    expect(leaf).toBe('same-hash');

    // If toStorageHash === leaf, it's a no-op
    const toStorageHash = 'same-hash';
    expect(leaf).toBe(toStorageHash);
  });

  it(
    'builds incremental migration chain',
    async () => {
      const tempDir = await createTempDir('incremental');
      const migrationsDir = join(tempDir, 'migrations');
      await mkdir(migrationsDir, { recursive: true });

      // First migration: empty -> A
      const dir1 = formatMigrationDirName(new Date(2026, 0, 1, 10, 0), 'add_user');
      const path1 = join(migrationsDir, dir1);
      const ops1 = [createTableOp('user')];
      await writeTestPackage(
        path1,
        {
          from: null,
          to: 'hash-a',
          providedInvariants: [],
          createdAt: new Date().toISOString(),
        },
        ops1,
      );

      // Second migration: A -> B
      const dir2 = formatMigrationDirName(new Date(2026, 0, 2, 10, 0), 'add_post');
      const path2 = join(migrationsDir, dir2);
      const ops2 = [createTableOp('post')];
      await writeTestPackage(
        path2,
        {
          from: 'hash-a',
          to: 'hash-b',
          providedInvariants: [],
          createdAt: new Date().toISOString(),
        },
        ops2,
      );

      // Verify migration chain
      const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
      expect(packages).toHaveLength(2);

      const graph = reconstructGraph(packages);
      const leaf = findLeaf(graph);
      expect(leaf).toBe('hash-b');

      // Verify chain: first migration's `to` === second migration's `from`
      const pkg1 = packages.find((p) => p.metadata.to === 'hash-a')!;
      const pkg2 = packages.find((p) => p.metadata.to === 'hash-b')!;
      expect(pkg1.metadata.to).toBe(pkg2.metadata.from);
    },
    timeouts.databaseOperation,
  );

  it('detects missing contract.json', async () => {
    const tempDir = await createTempDir('missing-contract');
    const nonexistent = join(tempDir, 'does-not-exist.json');

    let caughtError = false;
    try {
      await readFile(nonexistent, 'utf-8');
    } catch (error) {
      caughtError = true;
      expect((error as { code?: string }).code).toBe('ENOENT');
    }
    expect(caughtError).toBe(true);
  });
});

describe('--from hash lookup', () => {
  it('finds no package for unknown hash', async () => {
    const tempDir = await createTempDir('from-lookup');
    const migrationsDir = join(tempDir, 'migrations');
    await mkdir(migrationsDir, { recursive: true });

    const dirName = formatMigrationDirName(new Date(), 'test');
    const packageDir = join(migrationsDir, dirName);
    await writeTestPackage(
      packageDir,
      {
        from: null,
        to: 'known-hash',
        providedInvariants: [],
        createdAt: new Date().toISOString(),
      },
      [],
    );

    const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
    const found = packages.find((p) => p.metadata.to === 'nonexistent');
    expect(found).toBeUndefined();
  });

  it('resolves prefix without  scheme', async () => {
    const tempDir = await createTempDir('prefix-no-scheme');
    const migrationsDir = join(tempDir, 'migrations');
    await mkdir(migrationsDir, { recursive: true });

    const dirName = formatMigrationDirName(new Date(), 'test');
    const packageDir = join(migrationsDir, dirName);
    await writeTestPackage(
      packageDir,
      {
        from: null,
        to: 'abcdef1234567890',
        providedInvariants: [],
        createdAt: new Date().toISOString(),
      },
      [],
    );

    const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
    const result = resolveBundleByPrefix(packages, 'abcdef');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.to).toBe('abcdef1234567890');
    }
  });

  it('resolves prefix with  scheme', async () => {
    const tempDir = await createTempDir('prefix-with-scheme');
    const migrationsDir = join(tempDir, 'migrations');
    await mkdir(migrationsDir, { recursive: true });

    const dirName = formatMigrationDirName(new Date(), 'test');
    const packageDir = join(migrationsDir, dirName);
    await writeTestPackage(
      packageDir,
      {
        from: null,
        to: 'abcdef1234567890',
        providedInvariants: [],
        createdAt: new Date().toISOString(),
      },
      [],
    );

    const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
    const result = resolveBundleByPrefix(packages, 'abcdef');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.metadata.to).toBe('abcdef1234567890');
    }
  });

  it(
    'rejects ambiguous prefix matching multiple migrations',
    async () => {
      const tempDir = await createTempDir('prefix-ambiguous');
      const migrationsDir = join(tempDir, 'migrations');
      await mkdir(migrationsDir, { recursive: true });

      // Two migrations whose `to` hashes share a prefix
      const dir1 = formatMigrationDirName(new Date(2026, 0, 1), 'first');
      await writeTestPackage(
        join(migrationsDir, dir1),
        {
          from: null,
          to: 'abc111',
          providedInvariants: [],
          createdAt: new Date().toISOString(),
        },
        [],
      );

      const dir2 = formatMigrationDirName(new Date(2026, 0, 2), 'second');
      await writeTestPackage(
        join(migrationsDir, dir2),
        {
          from: 'abc111',
          to: 'abc222',
          providedInvariants: [],
          createdAt: new Date().toISOString(),
        },
        [],
      );

      const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
      const result = resolveBundleByPrefix(packages, 'abc');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure).toEqual({ reason: 'ambiguous', count: 2 });
      }
    },
    timeouts.databaseOperation,
  );
});

describe('MigrationToolsError passthrough shape', () => {
  it('MigrationToolsError is a CliStructuredError the CLI can pass straight through', () => {
    const error = new MigrationToolsError(
      'MIGRATION.DIR_EXISTS',
      'Migration directory already exists',
      {
        why: 'A migration directory with this name already exists on disk.',
        fix: 'Choose a different name or remove the existing directory.',
        meta: { dir: '/tmp/test' },
      },
    );

    expect(CliStructuredError.is(error)).toBe(true);
    expect(MigrationToolsError.is(error)).toBe(true);
    expect(error.name).toBe('CliStructuredError');
    expect(error.code).toBe('MIGRATION.DIR_EXISTS');
    expect(error.category).toBe('MIGRATION');
    expect(typeof error.why).toBe('string');
    expect(typeof error.fix).toBe('string');
    expect(error.toEnvelope()).toMatchObject({
      ok: false,
      code: 'MIGRATION.DIR_EXISTS',
      meta: { dir: '/tmp/test' },
    });
  });
});
