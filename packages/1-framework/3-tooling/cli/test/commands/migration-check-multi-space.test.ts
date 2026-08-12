import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { Contract } from '@internal/contract/types';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { loadContractSpaceAggregate } from '@internal/migration-tools/aggregate';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { type } from 'arktype';
import { join } from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type MigrationCheckResult,
  migrationCheckResultSchema,
} from '../../src/commands/migration-check';
import {
  enumerateCheckSpaces,
  runMigrationCheck,
} from '../../src/control-api/operations/migration-check';

/**
 * Exercises `migration check`'s multi-space policy core directly, mirroring
 * the disk-built-aggregate pattern `migration-list.test.ts` uses for
 * `runMigrationList`. Tests build a real `migrations/<space>/` tree in a
 * tmpdir, load the tolerant aggregate, enumerate the in-scope spaces, and
 * call `runMigrationCheck` — no `loadConfig` / CLI-shell mocking.
 *
 * The spine assertion: a non-app space's integrity defect surfaces in the
 * no-arg (all-spaces) check. Before D6 the explicit graph checks ran on the
 * app space only, so a dangling ref planted in an extension space passed
 * silently.
 */

const HASH_APP = `${'a'.repeat(64)}`;
const HASH_EXT = `${'b'.repeat(64)}`;
const HASH_DANGLING = `${'c'.repeat(64)}`;

const ADDITIVE_OP: MigrationPlanOperation = {
  id: 'table.users',
  label: 'Create table users',
  operationClass: 'additive',
};

const TEST_APP_CONTRACT = {
  storage: { storageHash: HASH_APP, namespaces: {} },
  schemaVersion: '1.0.0',
  target: 'postgres',
  targetFamily: 'sql',
  models: {},
} as unknown as Contract;

const identityDeserialize = (json: unknown): Contract => json as Contract;

interface PackageSpec {
  readonly spaceId: string;
  readonly dirName: string;
  readonly from: string | null;
  readonly to: string;
}

interface RefSpec {
  readonly spaceId: string;
  readonly name: string;
  readonly hash: string;
}

async function writePackage(migrationsRoot: string, spec: PackageSpec): Promise<void> {
  const pkgDir = join(migrationsRoot, spec.spaceId, spec.dirName);
  const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
    from: spec.from,
    to: spec.to,
    providedInvariants: [],
    createdAt: '2026-02-25T14:30:00.000Z',
  };
  const metadata: MigrationMetadata = {
    ...baseMetadata,
    migrationHash: computeMigrationHash(baseMetadata, [ADDITIVE_OP]),
  };
  await writeMigrationPackage(pkgDir, metadata, [ADDITIVE_OP]);
}

async function writeRefFor(migrationsRoot: string, spec: RefSpec): Promise<void> {
  const refsDir = join(migrationsRoot, spec.spaceId, 'refs');
  await mkdir(refsDir, { recursive: true });
  await writeRef(refsDir, spec.name, { hash: spec.hash, invariants: [] });
}

const createdDirs: string[] = [];

async function setupFixture(): Promise<{ cwd: string; migrationsRoot: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'cli-migration-check-'));
  createdDirs.push(cwd);
  return { cwd, migrationsRoot: join(cwd, 'migrations') };
}

afterEach(async () => {
  const dirs = createdDirs.splice(0);
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function checkFromDisk(inputs: {
  readonly migrationsDir: string;
  readonly spaceFilter?: string;
}): Promise<{ result?: MigrationCheckResult; failed: boolean }> {
  const aggregate = await loadContractSpaceAggregate({
    migrationsDir: inputs.migrationsDir,
    appContract: TEST_APP_CONTRACT,
    deserializeContract: identityDeserialize,
  });
  const spaces = await enumerateCheckSpaces(aggregate, inputs.migrationsDir, process.cwd());
  const outcome = await runMigrationCheck({
    spaces,
    ...(inputs.spaceFilter !== undefined ? { spaceFilter: inputs.spaceFilter } : {}),
  });
  if (!outcome.ok) {
    return { failed: true };
  }
  return { result: outcome.value, failed: false };
}

describe('migration check — multi-space policy core', () => {
  it('surfaces a dangling-ref defect planted in a NON-app space (no-arg checks all spaces)', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_init',
      from: null,
      to: HASH_APP,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260101T0000_install',
      from: null,
      to: HASH_EXT,
    });
    // Dangling ref in the extension space: points at a hash no migration
    // produces. Before D6 this passed silently (app-only checks).
    await writeRefFor(migrationsRoot, { spaceId: 'postgis', name: 'broken', hash: HASH_DANGLING });

    const { result } = await checkFromDisk({ migrationsDir: migrationsRoot });
    expect(result?.ok).toBe(false);
    const danglingRefFailures = result?.failures.filter(
      (f) => f.code === 'MIGRATION.CHECK_DANGLING_REF',
    );
    expect(danglingRefFailures).toHaveLength(1);
    expect(danglingRefFailures?.[0]?.where).toContain('postgis');
    expect(danglingRefFailures?.[0]?.where).toContain('broken');
  });

  it('passes a clean multi-space tree with no failures', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_init',
      from: null,
      to: HASH_APP,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260101T0000_install',
      from: null,
      to: HASH_EXT,
    });
    await writeRefFor(migrationsRoot, { spaceId: 'postgis', name: 'db', hash: HASH_EXT });

    const { result } = await checkFromDisk({ migrationsDir: migrationsRoot });
    expect(result?.ok).toBe(true);
    expect(result?.failures).toHaveLength(0);
  });

  it('surfaces an unreachable migration planted in a NON-app space', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_init',
      from: null,
      to: HASH_APP,
    });
    // Extension migration starts from a hash no migration produces and is
    // not the empty contract → unreachable.
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260101T0000_orphan',
      from: HASH_DANGLING,
      to: HASH_EXT,
    });

    const { result } = await checkFromDisk({ migrationsDir: migrationsRoot });
    expect(result?.ok).toBe(false);
    const unreachable = result?.failures.filter(
      (f) => f.code === 'MIGRATION.CHECK_UNREACHABLE_MIGRATION',
    );
    expect(unreachable).toHaveLength(1);
    expect(unreachable?.[0]?.where).toContain('postgis');
  });
});

describe('migration check — --space narrowing', () => {
  it('--space <extension> narrows checks to that space only', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_init',
      from: null,
      to: HASH_APP,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260101T0000_install',
      from: null,
      to: HASH_EXT,
    });
    // Dangling ref in BOTH spaces. Narrowing to postgis must report only
    // the postgis defect.
    await writeRefFor(migrationsRoot, { spaceId: 'app', name: 'broken', hash: HASH_DANGLING });
    await writeRefFor(migrationsRoot, { spaceId: 'postgis', name: 'broken', hash: HASH_DANGLING });

    const { result } = await checkFromDisk({
      migrationsDir: migrationsRoot,
      spaceFilter: 'postgis',
    });
    expect(result?.ok).toBe(false);
    const danglingRefFailures = result?.failures.filter(
      (f) => f.code === 'MIGRATION.CHECK_DANGLING_REF',
    );
    expect(danglingRefFailures).toHaveLength(1);
    expect(danglingRefFailures?.[0]?.where).toContain('postgis');
  });

  it('--space app narrows checks to the app space only', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_init',
      from: null,
      to: HASH_APP,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260101T0000_install',
      from: null,
      to: HASH_EXT,
    });
    await writeRefFor(migrationsRoot, { spaceId: 'app', name: 'broken', hash: HASH_DANGLING });
    await writeRefFor(migrationsRoot, { spaceId: 'postgis', name: 'broken', hash: HASH_DANGLING });

    const { result } = await checkFromDisk({
      migrationsDir: migrationsRoot,
      spaceFilter: 'app',
    });
    expect(result?.ok).toBe(false);
    const danglingRefFailures = result?.failures.filter(
      (f) => f.code === 'MIGRATION.CHECK_DANGLING_REF',
    );
    expect(danglingRefFailures).toHaveLength(1);
    expect(danglingRefFailures?.[0]?.where).toContain('app');
    expect(danglingRefFailures?.[0]?.where).not.toContain('postgis');
  });

  it('--space <bad-id> emits MIGRATION.INVALID_SPACE_ID', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_init',
      from: null,
      to: HASH_APP,
    });
    const aggregate = await loadContractSpaceAggregate({
      migrationsDir: migrationsRoot,
      appContract: TEST_APP_CONTRACT,
      deserializeContract: identityDeserialize,
    });
    const spaces = await enumerateCheckSpaces(aggregate, migrationsRoot, process.cwd());
    const outcome = await runMigrationCheck({ spaces, spaceFilter: '../escape' });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    const envelope = outcome.failure.toEnvelope();
    expect(envelope.code).toBe('MIGRATION.INVALID_SPACE_ID');
    expect(envelope.meta?.['spaceId']).toBe('../escape');
  });

  it('--space <unknown> emits MIGRATION.SPACE_NOT_FOUND', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_init',
      from: null,
      to: HASH_APP,
    });
    const aggregate = await loadContractSpaceAggregate({
      migrationsDir: migrationsRoot,
      appContract: TEST_APP_CONTRACT,
      deserializeContract: identityDeserialize,
    });
    const spaces = await enumerateCheckSpaces(aggregate, migrationsRoot, process.cwd());
    const outcome = await runMigrationCheck({ spaces, spaceFilter: 'nope' });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error('unreachable');
    const envelope = outcome.failure.toEnvelope();
    expect(envelope.code).toBe('MIGRATION.SPACE_NOT_FOUND');
    expect(envelope.meta?.['spaceId']).toBe('nope');
    expect(envelope.meta?.['availableSpaces']).toEqual(['app']);
  });
});

describe('migration check — migrationCheckResultSchema validation', () => {
  it('ok:true result validates against the schema', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_init',
      from: null,
      to: HASH_APP,
    });

    const aggregate = await loadContractSpaceAggregate({
      migrationsDir: migrationsRoot,
      appContract: TEST_APP_CONTRACT,
      deserializeContract: identityDeserialize,
    });
    const spaces = await enumerateCheckSpaces(aggregate, migrationsRoot, process.cwd());
    const outcome = await runMigrationCheck({ spaces });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');

    const result: MigrationCheckResult = outcome.value;
    expect(result.ok).toBe(true);
    expect(migrationCheckResultSchema(result) instanceof type.errors).toBe(false);
  });

  it('ok:false result with failures validates against the schema', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackage(migrationsRoot, {
      spaceId: 'app',
      dirName: '20260101T0000_init',
      from: null,
      to: HASH_APP,
    });
    await writePackage(migrationsRoot, {
      spaceId: 'postgis',
      dirName: '20260101T0000_install',
      from: null,
      to: HASH_EXT,
    });
    await writeRefFor(migrationsRoot, { spaceId: 'postgis', name: 'broken', hash: HASH_DANGLING });

    const aggregate = await loadContractSpaceAggregate({
      migrationsDir: migrationsRoot,
      appContract: TEST_APP_CONTRACT,
      deserializeContract: identityDeserialize,
    });
    const spaces = await enumerateCheckSpaces(aggregate, migrationsRoot, process.cwd());
    const outcome = await runMigrationCheck({ spaces });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error('unreachable');

    const result: MigrationCheckResult = outcome.value;
    expect(result.ok).toBe(false);
    expect(result.failures.length).toBeGreaterThan(0);
    expect(migrationCheckResultSchema(result) instanceof type.errors).toBe(false);

    const failure = result.failures[0]!;
    expect(failure.space).toBe('postgis');
    expect(failure.code).toBe('MIGRATION.CHECK_DANGLING_REF');
  });
});
