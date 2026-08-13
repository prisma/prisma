import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { MongoContractSerializer } from '@internal/family-mongo/ir';
import { timeouts } from '@repo/test-utils';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { join } from 'pathe';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  type EngineRunResult,
  runOnEngine,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';
import { runDbInit } from './utils/db-init-test-helpers';

const fixtureSubdir = 'control-policy/mongo';

async function writeEmittedContractArtifacts(testDir: string): Promise<void> {
  const contractModule = (await import(pathToFileURL(join(testDir, 'contract.ts')).href)) as {
    contract: Parameters<MongoContractSerializer['serializeContract']>[0];
  };
  const contractJson = new MongoContractSerializer().serializeContract(contractModule.contract);
  const outputDir = join(testDir, 'output');
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, 'contract.json'), JSON.stringify(contractJson), 'utf-8');
  writeFileSync(join(outputDir, 'contract.d.ts'), 'export {};\n', 'utf-8');
}

async function seedExternalAndObservedCollections(db: Db): Promise<void> {
  await db.createCollection('auth_users');
  await db.collection('auth_users').createIndex({ email: 1 }, { unique: true });
  await db.createCollection('legacy_jobs');
  await db.collection('legacy_jobs').createIndex({ status: 1 });
}

async function setupControlPolicyMongoFixture(
  db: Db,
  createTempDir: () => string,
  mongoUri: string,
) {
  await seedExternalAndObservedCollections(db);

  const testSetup = setupTestDirectoryFromFixtures(
    createTempDir,
    fixtureSubdir,
    'prisma.config.with-db.ts',
    { '{{MONGO_URI}}': mongoUri },
  );
  mkdirSync(join(testSetup.testDir, 'migrations', 'app'), { recursive: true });
  await writeEmittedContractArtifacts(testSetup.testDir);

  return { testSetup, configPath: testSetup.configPath };
}

async function collectionExists(db: Db, name: string): Promise<boolean> {
  const collections = await db.listCollections({ name }).toArray();
  return collections.length > 0;
}

async function runDbVerifySchemaOnly(testSetup: {
  readonly testDir: string;
  readonly configPath: string;
}): Promise<EngineRunResult> {
  return runOnEngine(testSetup, ['db', 'verify', '--schema-only', '--json']);
}

function expectVerifyFailed(run: EngineRunResult): void {
  expect(run.exitCode).toBe(4);
  expect(run.presented?.data).toMatchObject({ ok: false });
}

function expectVerifyPassed(run: EngineRunResult): void {
  expect(run.exitCode).toBe(0);
  expect(run.presented?.data).toMatchObject({ ok: true });
}

describe('control policy mongo CLI (e2e)', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  let db: Db;
  let mongoUri: string;
  const dbName = 'control_policy_mongo_e2e';

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      instanceOpts: [
        { launchTimeout: timeouts.spinUpMongoMemoryServer, storageEngine: 'wiredTiger' },
      ],
      replSet: { count: 1, storageEngine: 'wiredTiger', dbName },
    });
    const baseUri = replSet.getUri();
    const url = new URL(baseUri);
    url.pathname = `/${dbName}`;
    mongoUri = url.toString();
    client = new MongoClient(replSet.getUri());
    await client.connect();
    db = client.db(dbName);
  }, timeouts.spinUpMongoMemoryServer);

  afterAll(async () => {
    try {
      await client?.close();
      await replSet?.stop();
    } catch {
      // ignore cleanup errors
    }
  }, timeouts.spinUpMongoMemoryServer);

  withTempDir(({ createTempDir }) => {
    beforeEach(async () => {
      await db.dropDatabase();
    });

    it('managed: creates collection on db init and verifier fails after out-of-band drop', async () => {
      const { testSetup, configPath } = await setupControlPolicyMongoFixture(
        db,
        createTempDir,
        mongoUri,
      );

      await runDbInit(testSetup, ['--config', configPath, '--no-color']);

      expect(await collectionExists(db, 'catalog')).toBe(true);

      await db.collection('catalog').drop();

      const verify = await runDbVerifySchemaOnly(testSetup);
      expectVerifyFailed(verify);
    });

    it('tolerated: ignores extra indexes and fails when a declared index is removed', async () => {
      const { testSetup, configPath } = await setupControlPolicyMongoFixture(
        db,
        createTempDir,
        mongoUri,
      );

      await runDbInit(testSetup, ['--config', configPath, '--no-color']);

      await db.collection('audit_log').createIndex({ note: 1 });

      const withExtraIndex = await runDbVerifySchemaOnly(testSetup);
      expectVerifyPassed(withExtraIndex);

      const tsIndexName = (await db.collection('audit_log').indexes()).find(
        (idx) => JSON.stringify(idx.key) === JSON.stringify({ ts: 1 }),
      )?.name;
      expect(tsIndexName).toBeDefined();
      await db.collection('audit_log').dropIndex(tsIndexName!);

      const withDroppedIndex = await runDbVerifySchemaOnly(testSetup);
      expectVerifyFailed(withDroppedIndex);
    });

    it('external: leaves pre-seeded collection unchanged; verifier passes extras and fails declared drift', async () => {
      const { testSetup, configPath } = await setupControlPolicyMongoFixture(
        db,
        createTempDir,
        mongoUri,
      );

      const indexesBeforeInit = await db.collection('auth_users').indexes();

      await runDbInit(testSetup, ['--config', configPath, '--no-color']);

      const indexesAfterInit = await db.collection('auth_users').indexes();
      expect(indexesAfterInit.map((idx) => idx.name).sort()).toEqual(
        indexesBeforeInit.map((idx) => idx.name).sort(),
      );

      const afterInit = await runDbVerifySchemaOnly(testSetup);
      expectVerifyPassed(afterInit);

      await db.collection('auth_users').createIndex({ extra_note: 1 });

      const withExtraIndex = await runDbVerifySchemaOnly(testSetup);
      expectVerifyPassed(withExtraIndex);

      const emailIndexName = (await db.collection('auth_users').indexes()).find(
        (idx) => JSON.stringify(idx.key) === JSON.stringify({ email: 1 }),
      )?.name;
      expect(emailIndexName).toBeDefined();
      await db.collection('auth_users').dropIndex(emailIndexName!);

      const withDroppedIndex = await runDbVerifySchemaOnly(testSetup);
      expectVerifyFailed(withDroppedIndex);
    });

    it('observed: leaves pre-seeded collection unchanged and verifier passes despite drift', async () => {
      const { testSetup, configPath } = await setupControlPolicyMongoFixture(
        db,
        createTempDir,
        mongoUri,
      );

      expect(await collectionExists(db, 'legacy_jobs')).toBe(true);

      await runDbInit(testSetup, ['--config', configPath, '--no-color']);

      await db.collection('legacy_jobs').drop();

      const verify = await runDbVerifySchemaOnly(testSetup);
      expectVerifyPassed(verify);
      // Under the `observed` control policy the dropped collection warns but
      // does not fail: the failure lists stay empty (verify passes) AND the
      // warning is surfaced in the warnings channel — watch-without-failing,
      // not silent suppression.
      const data = verify.presented?.data as {
        schema: {
          issues: readonly unknown[];
          warnings: { issues: readonly { path: readonly string[] }[] };
        };
      };
      expect(data.schema.issues).toEqual([]);
      expect(
        data.schema.warnings.issues.some((w) => w.path.join('/').includes('legacy_jobs')),
      ).toBe(true);
    });
  });
});
