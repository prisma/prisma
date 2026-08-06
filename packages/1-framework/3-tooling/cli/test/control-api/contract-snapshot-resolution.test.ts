import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { PrismaNextConfig } from '@internal/config/config-types';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import {
  contractSnapshotDir,
  writeContractSnapshot,
} from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { formatMigrationDirName, writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveContractRefToSnapshot } from '../../src/control-api/operations/contract-snapshot-resolution';

const HASH_A = `${'a'.repeat(64)}`;
const HASH_FLOAT = `${'f'.repeat(64)}`;

function contractJsonForHash(storageHash: string): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    targetFamily: 'sql',
    target: 'postgres',
    storage: { storageHash },
    models: {},
  };
}

describe('resolveContractRefToSnapshot', () => {
  let tempDir: string;
  let migrationsDir: string;
  let appMigrationsDir: string;
  let refsDir: string;
  let contractPathAbsolute: string;
  let config: PrismaNextConfig;

  async function seedBaselineMigration(): Promise<void> {
    const timestamp = new Date(2026, 0, 1, 10, 0);
    const baseMetadata: Omit<MigrationMetadata, 'migrationHash'> = {
      from: null,
      to: HASH_A,
      providedInvariants: [],
      createdAt: timestamp.toISOString(),
    };
    const ops: MigrationPlanOperation[] = [
      { id: 'table.users', label: 'Create table "users"', operationClass: 'additive' },
    ];
    const metadata: MigrationMetadata = {
      ...baseMetadata,
      migrationHash: computeMigrationHash(baseMetadata, ops),
    };
    const dirName = formatMigrationDirName(timestamp, 'add-users');
    await writeMigrationPackage(join(appMigrationsDir, dirName), metadata, ops);
    await writeContractSnapshot(migrationsDir, HASH_A, {
      contractJson: contractJsonForHash(HASH_A),
      contractDts: 'export type Contract = unknown;\n',
    });
  }

  beforeEach(async () => {
    tempDir = join(
      tmpdir(),
      `snapshot-resolution-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    migrationsDir = join(tempDir, 'migrations');
    appMigrationsDir = join(migrationsDir, 'app');
    refsDir = join(appMigrationsDir, 'refs');
    await mkdir(refsDir, { recursive: true });
    contractPathAbsolute = join(tempDir, 'contract.json');
    await writeFile(contractPathAbsolute, JSON.stringify(contractJsonForHash(HASH_FLOAT)));
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
      contract: { output: contractPathAbsolute },
      migrations: { dir: 'migrations' },
    } as unknown as PrismaNextConfig;
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('resolves a bundle hit to the snapshot store contract', async () => {
    await seedBaselineMigration();
    const result = await resolveContractRefToSnapshot({
      config,
      migrationsDir,
      refInput: HASH_A,
      contractPathAbsolute,
      fallbackToEmitted: true,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        hash: HASH_A,
        contractJson: contractJsonForHash(HASH_A),
        contractJsonPath: join(contractSnapshotDir(migrationsDir, HASH_A), 'contract.json'),
        source: 'snapshot',
      },
    });
  });

  it('falls back to the emitted contract when its storage hash matches', async () => {
    await seedBaselineMigration();
    await writeRef(refsDir, 'floating', { hash: HASH_FLOAT, invariants: [] });
    const result = await resolveContractRefToSnapshot({
      config,
      migrationsDir,
      refInput: 'floating',
      contractPathAbsolute,
      fallbackToEmitted: true,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        hash: HASH_FLOAT,
        contractJson: contractJsonForHash(HASH_FLOAT),
        contractJsonPath: contractPathAbsolute,
        source: 'emitted',
      },
    });
  });

  it('refuses a non-matching fallback with the exact "No contract file found" envelope', async () => {
    const HASH_OTHER = `${'d'.repeat(64)}`;
    await seedBaselineMigration();
    await writeRef(refsDir, 'floating', { hash: HASH_OTHER, invariants: [] });
    const result = await resolveContractRefToSnapshot({
      config,
      migrationsDir,
      refInput: 'floating',
      contractPathAbsolute,
      fallbackToEmitted: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const envelope = result.failure.toEnvelope();
      expect(envelope.summary).toBe(`No contract file found for hash "${HASH_OTHER}"`);
      expect(envelope.why).toBe(
        `Resolved contract reference "floating" to hash "${HASH_OTHER}" but no migration produces that hash and the emitted contract does not match.`,
      );
      expect(envelope.fix).toBe(
        'Ensure the target contract exists on disk — either as a migration endpoint or as the emitted contract.json.',
      );
    }
  });

  it('refuses a missing bundle without fallback with the exact "No migration bundle found" envelope', async () => {
    await seedBaselineMigration();
    await writeRef(refsDir, 'floating', { hash: HASH_FLOAT, invariants: [] });
    const result = await resolveContractRefToSnapshot({
      config,
      migrationsDir,
      refInput: 'floating',
      contractPathAbsolute,
      fallbackToEmitted: false,
      missingBundleFlag: '--to',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const envelope = result.failure.toEnvelope();
      expect(envelope.summary).toBe(
        `No migration bundle found for --to "floating" (resolved hash: ${HASH_FLOAT})`,
      );
      expect(envelope.why).toBe(
        `The ref resolved successfully but no on-disk migration package has a destination (\`to\`) hash matching ${HASH_FLOAT}.`,
      );
      expect(envelope.fix).toBe(
        'Provide a ref or hash that corresponds to an existing migration package, or run `migration list` to see available migrations.',
      );
    }
  });

  it('maps an unresolvable reference through the ref-resolution envelope', async () => {
    await seedBaselineMigration();
    const result = await resolveContractRefToSnapshot({
      config,
      migrationsDir,
      refInput: 'no-such-ref',
      contractPathAbsolute,
      fallbackToEmitted: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const envelope = result.failure.toEnvelope();
      expect(envelope.summary).toBe('Not a known contract reference: "no-such-ref"');
      expect(envelope.meta).toMatchObject({ input: 'no-such-ref', grammar: 'contract' });
    }
  });
});
