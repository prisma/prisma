import { mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { MigrationToolsError } from '@internal/migration-tools/errors';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import {
  formatMigrationDirName,
  readMigrationsDir,
  writeMigrationPackage,
} from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { findPath, reconstructGraph } from '@internal/migration-tools/migration-graph';
import type { RefEntry } from '@internal/migration-tools/refs';
import { deleteRef, readRef, readRefs, resolveRef, writeRef } from '@internal/migration-tools/refs';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';

const HASH_A = `${'a'.repeat(64)}`;
const HASH_B = `${'b'.repeat(64)}`;
const HASH_C = `${'c'.repeat(64)}`;

const ENTRY_A: RefEntry = { hash: HASH_A, invariants: [] };
const ENTRY_B: RefEntry = { hash: HASH_B, invariants: [] };
const ENTRY_C: RefEntry = { hash: HASH_C, invariants: [] };

function createTableOp(table: string): MigrationPlanOperation {
  return {
    id: `table.${table}`,
    label: `Create table "${table}"`,
    operationClass: 'additive',
  };
}

async function createTempDir(prefix: string): Promise<string> {
  const dir = join(
    tmpdir(),
    `test-migration-ref-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(dir, { recursive: true });
  return dir;
}

async function writeAttestedMigration(
  migrationsDir: string,
  opts: {
    from: string | null;
    to: string;
    ops: MigrationPlanOperation[];
    timestamp: Date;
    slug: string;
  },
): Promise<{ dirName: string; migrationHash: string }> {
  const dirName = formatMigrationDirName(opts.timestamp, opts.slug);
  const packageDir = join(migrationsDir, dirName);
  const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
    from: opts.from,
    to: opts.to,
    providedInvariants: [],
    createdAt: opts.timestamp.toISOString(),
  };
  const migrationHash = computeMigrationHash(baseMetadata, opts.ops);
  const metadata: MigrationMetadata = { ...baseMetadata, migrationHash };
  await writeMigrationPackage(packageDir, metadata, opts.ops);
  return { dirName, migrationHash };
}

describe('ref-aware pathfinding integration', { timeout: timeouts.databaseOperation }, () => {
  it('resolves ref to target hash for pathfinding', async () => {
    const tempDir = await createTempDir('ref-pathfind');
    const migrationsDir = join(tempDir, 'migrations');
    const refsDir = join(migrationsDir, 'refs');
    await mkdir(migrationsDir, { recursive: true });

    await writeAttestedMigration(migrationsDir, {
      from: null,
      to: HASH_A,
      ops: [createTableOp('user')],
      timestamp: new Date(2026, 0, 1, 10, 0),
      slug: 'add_user',
    });

    await writeAttestedMigration(migrationsDir, {
      from: HASH_A,
      to: HASH_B,
      ops: [createTableOp('post')],
      timestamp: new Date(2026, 0, 2, 10, 0),
      slug: 'add_post',
    });

    await writeAttestedMigration(migrationsDir, {
      from: HASH_B,
      to: HASH_C,
      ops: [createTableOp('comment')],
      timestamp: new Date(2026, 0, 3, 10, 0),
      slug: 'add_comment',
    });

    await writeRef(refsDir, 'staging', ENTRY_C);
    await writeRef(refsDir, 'production', ENTRY_B);

    const stagingEntry = await readRef(refsDir, 'staging');
    const productionEntry = await readRef(refsDir, 'production');

    expect(stagingEntry.hash).toBe(HASH_C);
    expect(productionEntry.hash).toBe(HASH_B);

    const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
    const attested = packages;
    const graph = reconstructGraph(attested);

    const pathToStaging = findPath(graph, EMPTY_CONTRACT_HASH, stagingEntry.hash);
    expect(pathToStaging).toHaveLength(3);

    const pathToProduction = findPath(graph, EMPTY_CONTRACT_HASH, productionEntry.hash);
    expect(pathToProduction).toHaveLength(2);

    const pathStagingFromProd = findPath(graph, productionEntry.hash, stagingEntry.hash);
    expect(pathStagingFromProd).toHaveLength(1);
  });

  it('reports error for unknown ref', () => {
    const refs = { staging: ENTRY_A };
    expect(() => resolveRef(refs, 'production')).toThrow();

    try {
      resolveRef(refs, 'production');
    } catch (e) {
      expect(MigrationToolsError.is(e)).toBe(true);
      expect((e as MigrationToolsError).code).toBe('MIGRATION.UNKNOWN_REF');
    }
  });

  it('marker ahead of ref target produces no forward path', async () => {
    const tempDir = await createTempDir('ref-ahead');
    const migrationsDir = join(tempDir, 'migrations');
    const refsDir = join(migrationsDir, 'refs');
    await mkdir(migrationsDir, { recursive: true });

    await writeAttestedMigration(migrationsDir, {
      from: null,
      to: HASH_A,
      ops: [createTableOp('user')],
      timestamp: new Date(2026, 0, 1, 10, 0),
      slug: 'add_user',
    });

    await writeAttestedMigration(migrationsDir, {
      from: HASH_A,
      to: HASH_B,
      ops: [createTableOp('post')],
      timestamp: new Date(2026, 0, 2, 10, 0),
      slug: 'add_post',
    });

    await writeRef(refsDir, 'production', ENTRY_A);

    const entry = await readRef(refsDir, 'production');

    const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
    const attested = packages;
    const graph = reconstructGraph(attested);

    const markerHash = HASH_B;
    const forwardPath = findPath(graph, markerHash, entry.hash);
    expect(forwardPath).toBeNull();

    const reversePath = findPath(graph, entry.hash, markerHash);
    expect(reversePath).toHaveLength(1);
  });

  it('ref CRUD operations with per-file writes', async () => {
    const tempDir = await createTempDir('ref-crud');
    const migrationsDir = join(tempDir, 'migrations');
    const refsDir = join(migrationsDir, 'refs');
    await mkdir(migrationsDir, { recursive: true });

    let refs = await readRefs(refsDir);
    expect(refs).toEqual({});

    await writeRef(refsDir, 'staging', ENTRY_A);
    refs = await readRefs(refsDir);
    expect(refs).toEqual({ staging: ENTRY_A });

    await writeRef(refsDir, 'production', ENTRY_B);
    refs = await readRefs(refsDir);
    expect(refs).toEqual({ staging: ENTRY_A, production: ENTRY_B });

    await writeRef(refsDir, 'staging', ENTRY_C);
    refs = await readRefs(refsDir);
    expect(refs['staging']).toEqual(ENTRY_C);

    await deleteRef(refsDir, 'staging');
    refs = await readRefs(refsDir);
    expect(refs).toEqual({ production: ENTRY_B });

    const raw = await readFile(join(refsDir, 'production.json'), 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('status reports distance behind ref target', async () => {
    const tempDir = await createTempDir('ref-distance');
    const migrationsDir = join(tempDir, 'migrations');
    const refsDir = join(migrationsDir, 'refs');
    await mkdir(migrationsDir, { recursive: true });

    await writeAttestedMigration(migrationsDir, {
      from: null,
      to: HASH_A,
      ops: [createTableOp('user')],
      timestamp: new Date(2026, 0, 1, 10, 0),
      slug: 'add_user',
    });

    await writeAttestedMigration(migrationsDir, {
      from: HASH_A,
      to: HASH_B,
      ops: [createTableOp('post')],
      timestamp: new Date(2026, 0, 2, 10, 0),
      slug: 'add_post',
    });

    const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
    const attested = packages;
    const graph = reconstructGraph(attested);

    await writeRef(refsDir, 'production', ENTRY_B);

    const refs = await readRefs(refsDir);
    const refEntry = resolveRef(refs, 'production');

    const markerHash = EMPTY_CONTRACT_HASH;
    const pathToRef = findPath(graph, markerHash, refEntry.hash);
    expect(pathToRef).toHaveLength(2);

    const atTarget = markerHash === refEntry.hash;
    expect(atTarget).toBe(false);

    const markerAtA = HASH_A;
    const pathFromA = findPath(graph, markerAtA, refEntry.hash);
    expect(pathFromA).toHaveLength(1);

    const markerAtB = HASH_B;
    const pathFromB = findPath(graph, markerAtB, refEntry.hash);
    expect(pathFromB).toEqual([]);
  });

  it('independent applies against different refs produce correct results', async () => {
    const tempDir = await createTempDir('ref-independent');
    const migrationsDir = join(tempDir, 'migrations');
    const refsDir = join(migrationsDir, 'refs');
    await mkdir(migrationsDir, { recursive: true });

    await writeAttestedMigration(migrationsDir, {
      from: null,
      to: HASH_A,
      ops: [createTableOp('user')],
      timestamp: new Date(2026, 0, 1, 10, 0),
      slug: 'add_user',
    });

    await writeAttestedMigration(migrationsDir, {
      from: HASH_A,
      to: HASH_B,
      ops: [createTableOp('post')],
      timestamp: new Date(2026, 0, 2, 10, 0),
      slug: 'add_post',
    });

    await writeRef(refsDir, 'staging', { hash: HASH_B, invariants: [] });
    await writeRef(refsDir, 'production', ENTRY_A);

    const refs = await readRefs(refsDir);
    const { packages } = await readMigrationsDir(migrationsDir, { migrationsDir });
    const attested = packages;
    const graph = reconstructGraph(attested);

    const stagingPath = findPath(graph, EMPTY_CONTRACT_HASH, resolveRef(refs, 'staging').hash);
    expect(stagingPath).toHaveLength(2);

    const productionPath = findPath(
      graph,
      EMPTY_CONTRACT_HASH,
      resolveRef(refs, 'production').hash,
    );
    expect(productionPath).toHaveLength(1);

    const refsAfter = await readRefs(refsDir);
    expect(refsAfter).toEqual({
      staging: { hash: HASH_B, invariants: [] },
      production: ENTRY_A,
    });
  });
});
