/**
 * `migration check` adversarial fixtures.
 *
 * Exercises each PN code under INTEGRITY_FAILED (exit 4) and the
 * clean-graph pass (exit 0). Each test plants a specific corruption
 * after a successful plan+emit and asserts the expected PN code.
 *
 * The clean-graph and PRECONDITION tests use the in-process helper
 * (exit 0 and exit 2 are captured reliably). Adversarial tests that
 * expect exit 4 assert on the JSON output's `failures[].code`
 * without asserting the exit code, since the in-process test mock
 * captures commander's re-thrown exit rather than the command's own.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { contractSnapshotDir } from '@prisma/orm-postgres/migration-tools/contract-snapshot-store';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../utils/cli-test-helpers';
import {
  type JourneyContext,
  parseJsonOutput,
  runContractEmit,
  runMigrationCheck,
  runMigrationPlanAndEmit,
  setupJourney,
  timeouts,
} from '../utils/journey-test-helpers';

function findLatestMigrationDir(ctx: JourneyContext): string {
  const appDir = join(ctx.testDir, 'migrations', 'app');
  if (!existsSync(appDir)) throw new Error('No migrations/app dir');
  const entries = readdirSync(appDir)
    .filter((e) => !e.startsWith('.') && !e.startsWith('_') && e !== 'refs')
    .sort();
  if (entries.length === 0) throw new Error('No migration directories');
  return join(appDir, entries[entries.length - 1]!);
}

function snapshotContractJsonPath(ctx: JourneyContext, storageHash: string): string {
  return join(contractSnapshotDir(join(ctx.testDir, 'migrations'), storageHash), 'contract.json');
}

withTempDir(({ createTempDir }) => {
  describe('migration check', () => {
    it(
      'clean graph passes with exit 0',
      async () => {
        const ctx: JourneyContext = setupJourney({ createTempDir });

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'emit').toBe(0);
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'init']);
        expect(plan.exitCode, 'plan').toBe(0);

        const check = await runMigrationCheck(ctx, ['--json']);
        expect(check.exitCode, 'check exit code').toBe(0);
        const json = parseJsonOutput(check);
        expect(json?.['ok']).toBe(true);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'hash mismatch (tampered migrationHash) → MIGRATION.CHECK_HASH_MISMATCH',
      async () => {
        const ctx: JourneyContext = setupJourney({ createTempDir });

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'emit').toBe(0);
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'init']);
        expect(plan.exitCode, 'plan').toBe(0);

        const migDir = findLatestMigrationDir(ctx);
        const manifestPath = join(migDir, 'migration.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        manifest.migrationHash = `${'0'.repeat(64)}`;
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

        const check = await runMigrationCheck(ctx, ['--json']);
        const json = parseJsonOutput(check);
        expect(json?.['ok']).toBe(false);
        const failures = json?.['failures'] as readonly Record<string, string>[];
        expect(failures.length).toBeGreaterThan(0);
        expect(failures.some((f) => f['code'] === 'MIGRATION.CHECK_HASH_MISMATCH')).toBe(true);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'missing manifest file → MIGRATION.CHECK_FILE_MISSING',
      async () => {
        const ctx: JourneyContext = setupJourney({ createTempDir });

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'emit').toBe(0);
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'init']);
        expect(plan.exitCode, 'plan').toBe(0);

        const appDir = join(ctx.testDir, 'migrations', 'app');
        const emptyDir = join(appDir, '99990101T0000_orphan-empty');
        mkdirSync(emptyDir, { recursive: true });

        const check = await runMigrationCheck(ctx, ['--json']);
        const json = parseJsonOutput(check);
        expect(json?.['ok']).toBe(false);
        const failures = json?.['failures'] as readonly Record<string, string>[];
        expect(failures.some((f) => f['code'] === 'MIGRATION.CHECK_FILE_MISSING')).toBe(true);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'orphan migration → MIGRATION.CHECK_UNREACHABLE_MIGRATION',
      async () => {
        const ctx: JourneyContext = setupJourney({ createTempDir });

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'emit').toBe(0);
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'init']);
        expect(plan.exitCode, 'plan').toBe(0);

        const migDir = findLatestMigrationDir(ctx);
        const manifestPath = join(migDir, 'migration.json');
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

        const appDir = join(ctx.testDir, 'migrations', 'app');
        const orphanDir = join(appDir, '99990101T0000_orphan');
        mkdirSync(orphanDir, { recursive: true });

        const orphanManifest = {
          ...manifest,
          from: `deadbeef${'0'.repeat(56)}`,
          to: `cafebabe${'0'.repeat(56)}`,
        };
        const orphanOps = readFileSync(join(migDir, 'ops.json'), 'utf-8');

        const { computeMigrationHash } = await import('@prisma/orm-postgres/migration-tools/hash');
        orphanManifest.migrationHash = computeMigrationHash(orphanManifest, JSON.parse(orphanOps));

        writeFileSync(join(orphanDir, 'migration.json'), JSON.stringify(orphanManifest, null, 2));
        writeFileSync(join(orphanDir, 'ops.json'), orphanOps);

        const check = await runMigrationCheck(ctx, ['--json']);
        const json = parseJsonOutput(check);
        expect(json?.['ok']).toBe(false);
        const failures = json?.['failures'] as readonly Record<string, string>[];
        expect(failures.some((f) => f['code'] === 'MIGRATION.CHECK_UNREACHABLE_MIGRATION')).toBe(
          true,
        );
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'dangling ref → MIGRATION.CHECK_DANGLING_REF',
      async () => {
        const ctx: JourneyContext = setupJourney({ createTempDir });

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'emit').toBe(0);
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'init']);
        expect(plan.exitCode, 'plan').toBe(0);

        const danglingHash = `${'f'.repeat(64)}`;
        const refsDir = join(ctx.testDir, 'migrations', 'app', 'refs');
        mkdirSync(refsDir, { recursive: true });
        writeFileSync(
          join(refsDir, 'dangling.json'),
          `${JSON.stringify({ hash: danglingHash, invariants: [] }, null, 2)}\n`,
        );

        const check = await runMigrationCheck(ctx, ['--json']);
        const json = parseJsonOutput(check);
        expect(json?.['ok']).toBe(false);
        const failures = json?.['failures'] as readonly Record<string, string>[];
        expect(failures.some((f) => f['code'] === 'MIGRATION.CHECK_DANGLING_REF')).toBe(true);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'edge mismatch (contract snapshot disagrees with metadata) → MIGRATION.CHECK_SNAPSHOT_HASH_MISMATCH',
      async () => {
        const ctx: JourneyContext = setupJourney({ createTempDir });

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'emit').toBe(0);
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'init']);
        expect(plan.exitCode, 'plan').toBe(0);

        const migDir = findLatestMigrationDir(ctx);
        const manifest = JSON.parse(readFileSync(join(migDir, 'migration.json'), 'utf-8'));
        const snapshotPath = snapshotContractJsonPath(ctx, manifest.to);
        const contract = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
        contract.storage.storageHash = 'd'.repeat(64);
        writeFileSync(snapshotPath, JSON.stringify(contract, null, 2));

        const check = await runMigrationCheck(ctx, ['--json']);
        const json = parseJsonOutput(check);
        expect(json?.['ok']).toBe(false);
        const failures = json?.['failures'] as readonly Record<string, string>[];
        expect(failures.length).toBeGreaterThan(0);
        expect(failures.some((f) => f['code'] === 'MIGRATION.CHECK_SNAPSHOT_HASH_MISMATCH')).toBe(
          true,
        );
      },
      timeouts.typeScriptCompilation,
    );

    // The per-migration code path used to only run PN-001 and PN-002 — it
    // skipped the snapshot-consistency check that the graph-wide path
    // performs, so a corruption that graph-wide caught reported `ok: true`
    // in per-migration mode. The shared snapshot-consistency helper is
    // now called from both branches; this test pins the parity so the
    // asymmetry can't drift back.
    it(
      'per-migration check detects MIGRATION.CHECK_SNAPSHOT_HASH_MISMATCH in the same way graph-wide does',
      async () => {
        const ctx: JourneyContext = setupJourney({ createTempDir });

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'emit').toBe(0);
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'init']);
        expect(plan.exitCode, 'plan').toBe(0);

        const migDir = findLatestMigrationDir(ctx);
        const dirName = migDir.split('/').pop() ?? '';
        const manifest = JSON.parse(readFileSync(join(migDir, 'migration.json'), 'utf-8'));
        const snapshotPath = snapshotContractJsonPath(ctx, manifest.to);
        const contract = JSON.parse(readFileSync(snapshotPath, 'utf-8'));
        contract.storage.storageHash = 'd'.repeat(64);
        writeFileSync(snapshotPath, JSON.stringify(contract, null, 2));

        const check = await runMigrationCheck(ctx, [dirName, '--json']);
        const json = parseJsonOutput(check);
        expect(json?.['ok'], 'per-migration check reports failure').toBe(false);
        const failures = json?.['failures'] as readonly Record<string, string>[];
        expect(
          failures.some((f) => f['code'] === 'MIGRATION.CHECK_SNAPSHOT_HASH_MISMATCH'),
          'per-migration check carries MIGRATION.CHECK_SNAPSHOT_HASH_MISMATCH',
        ).toBe(true);
      },
      timeouts.typeScriptCompilation,
    );

    it(
      'non-existent named migration → exit 2, PRECONDITION',
      async () => {
        const ctx: JourneyContext = setupJourney({ createTempDir });

        const emit = await runContractEmit(ctx);
        expect(emit.exitCode, 'emit').toBe(0);
        const plan = await runMigrationPlanAndEmit(ctx, ['--name', 'init']);
        expect(plan.exitCode, 'plan').toBe(0);

        const check = await runMigrationCheck(ctx, ['nonexistent-migration', '--json']);
        expect(check.exitCode, 'check exit code').toBe(2);
      },
      timeouts.typeScriptCompilation,
    );
  });
});
