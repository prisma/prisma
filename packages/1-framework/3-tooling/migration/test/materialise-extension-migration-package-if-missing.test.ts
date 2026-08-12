import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { materialiseExtensionMigrationPackageIfMissing } from '../src/io';
import { createTestMetadata, createTestOps } from './fixtures';

describe('materialiseExtensionMigrationPackageIfMissing', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'materialise-if-missing-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes the package and returns { written: true } on first run', async () => {
    const ops = createTestOps();
    const metadata = createTestMetadata({}, ops);
    const pkg = { dirName: 'baseline', metadata, ops };

    const result = await materialiseExtensionMigrationPackageIfMissing(tmpDir, pkg);

    expect(result.written).toBe(true);
    const manifest = await readFile(join(tmpDir, pkg.dirName, 'migration.json'), 'utf-8');
    expect(manifest).toContain(metadata.migrationHash);
  });

  it('returns { written: false } when <targetDir>/<pkg.dirName>/ already exists', async () => {
    const ops = createTestOps();
    const metadata = createTestMetadata({}, ops);
    const pkg = { dirName: 'baseline', metadata, ops };

    await materialiseExtensionMigrationPackageIfMissing(tmpDir, pkg);
    const second = await materialiseExtensionMigrationPackageIfMissing(tmpDir, pkg);

    expect(second.written).toBe(false);
  });

  it('leaves on-disk content byte-identical when the dir already exists', async () => {
    const ops = createTestOps();
    const metadata = createTestMetadata({}, ops);
    const pkg = { dirName: 'baseline', metadata, ops };

    await materialiseExtensionMigrationPackageIfMissing(tmpDir, pkg);

    const before = await Promise.all(
      ['migration.json', 'ops.json'].map((name) =>
        readFile(join(tmpDir, pkg.dirName, name), 'utf-8'),
      ),
    );

    await materialiseExtensionMigrationPackageIfMissing(tmpDir, pkg);

    const after = await Promise.all(
      ['migration.json', 'ops.json'].map((name) =>
        readFile(join(tmpDir, pkg.dirName, name), 'utf-8'),
      ),
    );

    expect(after).toEqual(before);
  });

  it('creates the parent target directory if it does not yet exist', async () => {
    const nested = join(tmpDir, 'cipherstash');
    const pkg = {
      dirName: 'baseline',
      metadata: createTestMetadata({}, []),
      ops: [],
    };

    const result = await materialiseExtensionMigrationPackageIfMissing(nested, pkg);

    expect(result.written).toBe(true);
    const manifest = await readFile(join(nested, pkg.dirName, 'migration.json'), 'utf-8');
    expect(manifest).toBeDefined();
  });
});
