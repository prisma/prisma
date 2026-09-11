import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import type { MigrationPlanOperation } from '@internal/framework-components/control';
import {
  contractSnapshotDir,
  writeContractSnapshot,
} from '@internal/migration-tools/contract-snapshot-store';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { writeMigrationPackage } from '@internal/migration-tools/io';
import type { MigrationMetadata } from '@internal/migration-tools/metadata';
import { writeRef } from '@internal/migration-tools/refs';
import { blindCast } from '@internal/utils/casts';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CONNECTION,
  cleanupProjectDirs,
  EMITTED_CONTRACT_DTS,
  envelopeOf,
  HASH_A,
  HASH_PREVIOUS,
  harness,
  MISSING_COLUMN,
  mocks,
  ormConfig,
  projectDir,
  refHashOf,
  refsDirOf,
  resetMocks,
  schemaResult,
} from './db-sign-fixtures';

const HASH_B = `55bada2${'0'.repeat(57)}`;
const SNAPSHOT_B_DTS = 'export type Contract = { b: true };\n';

beforeEach(resetMocks);
afterEach(cleanupProjectDirs);

describe('db sign', () => {
  describe('ref advancement', () => {
    it('writes the db ref and the snapshot of the signed contract', async () => {
      const dir = await projectDir();

      const run = await harness(ormConfig()).run(['db', 'sign', '--json'], { cwd: dir });

      expect(run.exitCode).toBe(0);
      expect(await refHashOf(dir, 'db')).toBe(HASH_A);
      const storeDir = contractSnapshotDir(join(dir, 'migrations'), HASH_A);
      expect(JSON.parse(await readFile(join(storeDir, 'contract.json'), 'utf-8'))).toEqual({
        storage: { storageHash: HASH_A },
        target: 'postgres',
      });
      expect(await readFile(join(storeDir, 'contract.d.ts'), 'utf-8')).toBe(EMITTED_CONTRACT_DTS);
    });

    it('still advances db when --db names the database', async () => {
      const dir = await projectDir();

      const run = await harness(ormConfig({ db: undefined })).run(
        ['db', 'sign', '--db', CONNECTION, '--json'],
        { cwd: dir },
      );

      expect(run.exitCode).toBe(0);
      expect(run.presented?.data).toMatchObject({ advancedRef: { name: 'db', hash: HASH_A } });
      expect(await refHashOf(dir, 'db')).toBe(HASH_A);
    });

    it('advances the ref named by --advance-ref and leaves db untouched', async () => {
      const dir = await projectDir();

      const run = await harness(ormConfig()).run(
        ['db', 'sign', '--advance-ref', 'staging', '--json'],
        { cwd: dir },
      );

      expect(run.exitCode).toBe(0);
      expect(run.presented?.data).toMatchObject({
        advancedRef: { name: 'staging', hash: HASH_A },
      });
      expect(await refHashOf(dir, 'staging')).toBe(HASH_A);
      expect(await refHashOf(dir, 'db')).toBeUndefined();
    });

    it('overwrites a ref pointing elsewhere and reports the previous hash', async () => {
      const dir = await projectDir();
      await writeRef(refsDirOf(dir), 'db', { hash: HASH_PREVIOUS, invariants: [] });

      const run = await harness(ormConfig()).run(['db', 'sign'], {
        cwd: dir,
        isTty: { stdout: true },
      });

      expect(run.exitCode).toBe(0);
      expect(await refHashOf(dir, 'db')).toBe(HASH_A);
      expect(run.presented?.presentation.human.at(-1)).toEqual({
        kind: 'summary',
        status: 'ok',
        text: [
          { text: 'Advanced ref "db" → ' },
          { text: HASH_A, tone: 'identifier' },
          { text: ' (was ', tone: 'muted' },
          { text: HASH_PREVIOUS, tone: 'identifier' },
          { text: ')', tone: 'muted' },
        ],
      });
    });

    it('settles a rejected ref name as a structured failure after the marker is written', async () => {
      const dir = await projectDir();

      const run = await harness(ormConfig()).run(
        ['db', 'sign', '--advance-ref', 'Not A Ref', '--json'],
        { cwd: dir },
      );

      expect(run.exitCode).toBe(2);
      expect(envelopeOf(run)).toMatchObject({
        ok: false,
        error: { code: 'MIGRATION.INVALID_REF_NAME' },
      });
      expect(mocks.sign).toHaveBeenCalledTimes(1);
      expect(existsSync(refsDirOf(dir))).toBe(false);
    });

    it('writes no ref when verification refuses the signature', async () => {
      const dir = await projectDir();
      mocks.schemaVerify.mockResolvedValue(
        schemaResult({
          ok: false,
          code: 'CONTRACT.SCHEMA_VERIFICATION_FAILED',
          summary: 'Database schema does not satisfy contract',
          schema: { issues: [MISSING_COLUMN] },
        }),
      );

      const run = await harness(ormConfig()).run(['db', 'sign', '--json'], { cwd: dir });

      expect(run.exitCode).toBe(4);
      expect(existsSync(refsDirOf(dir))).toBe(false);
      expect(existsSync(join(dir, 'migrations', 'snapshots'))).toBe(false);
    });

    it('settles a missing contract.d.ts as a file-not-found failure after the marker is written', async () => {
      const dir = await projectDir();
      await rm(join(dir, 'output', 'contract.d.ts'));

      const run = await harness(ormConfig()).run(['db', 'sign', '--json'], { cwd: dir });

      expect(run.exitCode).toBe(2);
      expect(envelopeOf(run)).toMatchObject({
        ok: false,
        error: { code: 'CLI.FILE_NOT_FOUND' },
      });
      expect(JSON.stringify(run.json.at(-1))).toContain('contract.d.ts');
      expect(mocks.sign).toHaveBeenCalledTimes(1);
      expect(existsSync(refsDirOf(dir))).toBe(false);
    });

    it('writes the snapshot from the resolved contract when a migration dir is named', async () => {
      const dir = await projectDir();
      const dirName = '20260102T0000_add_users';
      const ops = [
        blindCast<MigrationPlanOperation, 'db sign reads only the destination hash'>({
          id: 'table.users',
          label: 'Create users',
          operationClass: 'additive',
        }),
      ];
      const base = blindCast<
        Omit<MigrationMetadata, 'migrationHash'>,
        'db sign reads only from/to'
      >({
        from: HASH_A,
        to: HASH_B,
        providedInvariants: [],
        createdAt: '2026-01-02T10:00:00.000Z',
      });
      const metadata: MigrationMetadata = {
        ...base,
        migrationHash: computeMigrationHash(base, ops),
      };
      await writeMigrationPackage(join(dir, 'migrations', 'app', dirName), metadata, ops);
      const snapshotB = { storage: { storageHash: HASH_B }, target: 'postgres' };
      await writeContractSnapshot(join(dir, 'migrations'), HASH_B, {
        contractJson: snapshotB,
        contractDts: SNAPSHOT_B_DTS,
      });

      const run = await harness(ormConfig()).run(['db', 'sign', dirName, '--json'], {
        cwd: dir,
      });

      expect(run.exitCode).toBe(0);
      expect(mocks.sign).toHaveBeenCalledTimes(1);
      const signArg = mocks.sign.mock.calls[0]?.[0] as {
        contract: { storage: { storageHash: string } };
      };
      expect(signArg.contract.storage.storageHash).toBe(HASH_B);
      expect(await refHashOf(dir, 'db')).toBe(HASH_B);
      const storeDir = contractSnapshotDir(join(dir, 'migrations'), HASH_B);
      expect(JSON.parse(await readFile(join(storeDir, 'contract.json'), 'utf-8'))).toEqual(
        snapshotB,
      );
      expect(await readFile(join(storeDir, 'contract.d.ts'), 'utf-8')).toBe(SNAPSHOT_B_DTS);
    });
  });
});
