import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { Contract } from '@internal/contract/types';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { loadContractSpaceAggregate } from '@internal/migration-tools/aggregate';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { join } from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import type { MigrationCheckResult } from '../../src/commands/migration-check';
import {
  enumerateCheckSpaces,
  runMigrationCheck,
} from '../../src/control-api/operations/migration-check';

/**
 * `checkSnapshotConsistency` reads the destination snapshot keyed by
 * `pkg.metadata.to`. Nothing in the on-disk manifest schema validates that
 * `to` is a well-formed `64-hex` value (`io.ts` only checks it is a
 * non-empty string), so a hand-edited or corrupted `migration.json` can
 * carry a malformed `to`. This must surface as a clean `MIGRATION.CHECK_SNAPSHOT_UNPARSEABLE`
 * failure, not an unhandled crash.
 */

const HASH_APP = 'a'.repeat(64);
const MALFORMED_HASH = 'not-a-sha256-hash';

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

async function writePackageWithTo(
  migrationsRoot: string,
  dirName: string,
  to: string,
): Promise<void> {
  const pkgDir = join(migrationsRoot, 'app', dirName);
  const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
    from: null,
    to,
    providedInvariants: [],
    createdAt: '2026-02-25T14:30:00.000Z',
  };
  const metadata: MigrationMetadata = {
    ...baseMetadata,
    migrationHash: computeMigrationHash(baseMetadata, [ADDITIVE_OP]),
  };
  await writeMigrationPackage(pkgDir, metadata, [ADDITIVE_OP]);
}

const createdDirs: string[] = [];

async function setupFixture(): Promise<{ migrationsRoot: string }> {
  const cwd = await mkdtemp(join(tmpdir(), 'cli-migration-check-snapshot-'));
  createdDirs.push(cwd);
  return { migrationsRoot: join(cwd, 'migrations') };
}

afterEach(async () => {
  const dirs = createdDirs.splice(0);
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function checkFromDisk(migrationsDir: string): Promise<MigrationCheckResult> {
  const aggregate = await loadContractSpaceAggregate({
    migrationsDir,
    appContract: TEST_APP_CONTRACT,
    deserializeContract: identityDeserialize,
  });
  const spaces = await enumerateCheckSpaces(aggregate, migrationsDir, process.cwd());
  const outcome = await runMigrationCheck({ spaces });
  if (!outcome.ok) throw new Error('runMigrationCheck rejected unexpectedly');
  return outcome.value;
}

describe('migration check — snapshot consistency with a malformed to-hash', () => {
  it('surfaces MIGRATION.CHECK_SNAPSHOT_UNPARSEABLE instead of crashing when metadata.to is not 64-hex', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackageWithTo(migrationsRoot, '20260101T0000_init', MALFORMED_HASH);

    const result = await checkFromDisk(migrationsRoot);

    expect(result.ok).toBe(false);
    const failure = result.failures.find((f) => f.code === 'MIGRATION.CHECK_SNAPSHOT_UNPARSEABLE');
    expect(failure).toBeDefined();
    expect(failure?.why).toContain(MALFORMED_HASH);
  });

  it('does not report a snapshot-consistency failure when the store entry is legitimately absent (runner independence)', async () => {
    const { migrationsRoot } = await setupFixture();
    await writePackageWithTo(migrationsRoot, '20260101T0000_init', HASH_APP);

    const result = await checkFromDisk(migrationsRoot);

    const snapshotFailures = result.failures.filter((f) =>
      ['MIGRATION.CHECK_SNAPSHOT_HASH_MISMATCH', 'MIGRATION.CHECK_SNAPSHOT_UNPARSEABLE'].includes(
        f.code,
      ),
    );
    expect(snapshotFailures).toHaveLength(0);
  });
});
