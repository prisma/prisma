import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createDbVerifyCommand } from '@internal/cli/commands/db-verify';
import { MongoContractSerializer } from '@internal/family-mongo/ir';
import { timeouts } from '@repo/test-utils';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { join } from 'pathe';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  executeCommand,
  getExitCode,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';
import { runDbInit } from './utils/db-init-test-helpers';

const fixtureSubdir = 'control-policy/mongo';

function extractJson(lines: string[]): Record<string, unknown> {
  const joined = lines.join('\n');
  const start = joined.indexOf('{');
  const end = joined.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in output:\n${joined}`);
  }
  return JSON.parse(joined.slice(start, end + 1)) as Record<string, unknown>;
}

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
    'prisma-next.config.with-db.ts',
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

async function runDbVerifyJson(
  testDir: string,
  configPath: string,
  consoleOutput: string[],
  outputStartIndex: number,
): Promise<{ exitCode: number; parsed: Record<string, unknown> }> {
  const command = createDbVerifyCommand();
  const verifyCwd = process.cwd();
  try {
    process.chdir(testDir);
    try {
      await executeCommand(command, [
        '--config',
        configPath,
        '--schema-only',
        '--json',
        '--no-color',
      ]);
    } catch {
      // db verify exits via process.exit on failure
    }
  } finally {
    process.chdir(verifyCwd);
  }
  const exitCode = getExitCode() ?? 0;
  const parsed = extractJson(consoleOutput.slice(outputStartIndex));
  return { exitCode, parsed };
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
    let consoleOutput: string[] = [];
    let cleanupMocks: () => void = () => {};

    beforeEach(async () => {
      await db.dropDatabase();
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
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

      const outputStartIndex = consoleOutput.length;
      const { exitCode, parsed } = await runDbVerifyJson(
        testSetup.testDir,
        configPath,
        consoleOutput,
        outputStartIndex,
      );
      expect(exitCode).toBe(1);
      expect(parsed['ok']).toBe(false);
    });

    it('tolerated: ignores extra indexes and fails when a declared index is removed', async () => {
      const { testSetup, configPath } = await setupControlPolicyMongoFixture(
        db,
        createTempDir,
        mongoUri,
      );

      await runDbInit(testSetup, ['--config', configPath, '--no-color']);

      await db.collection('audit_log').createIndex({ note: 1 });

      let outputStartIndex = consoleOutput.length;
      let verify = await runDbVerifyJson(
        testSetup.testDir,
        configPath,
        consoleOutput,
        outputStartIndex,
      );
      expect(verify.exitCode).toBe(0);
      expect(verify.parsed['ok']).toBe(true);

      const tsIndexName = (await db.collection('audit_log').indexes()).find(
        (idx) => JSON.stringify(idx.key) === JSON.stringify({ ts: 1 }),
      )?.name;
      expect(tsIndexName).toBeDefined();
      await db.collection('audit_log').dropIndex(tsIndexName!);

      outputStartIndex = consoleOutput.length;
      verify = await runDbVerifyJson(
        testSetup.testDir,
        configPath,
        consoleOutput,
        outputStartIndex,
      );
      expect(verify.exitCode).toBe(1);
      expect(verify.parsed['ok']).toBe(false);
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

      let outputStartIndex = consoleOutput.length;
      let verify = await runDbVerifyJson(
        testSetup.testDir,
        configPath,
        consoleOutput,
        outputStartIndex,
      );
      expect(verify.exitCode).toBe(0);
      expect(verify.parsed['ok']).toBe(true);

      await db.collection('auth_users').createIndex({ extra_note: 1 });

      outputStartIndex = consoleOutput.length;
      verify = await runDbVerifyJson(
        testSetup.testDir,
        configPath,
        consoleOutput,
        outputStartIndex,
      );
      expect(verify.exitCode).toBe(0);
      expect(verify.parsed['ok']).toBe(true);

      const emailIndexName = (await db.collection('auth_users').indexes()).find(
        (idx) => JSON.stringify(idx.key) === JSON.stringify({ email: 1 }),
      )?.name;
      expect(emailIndexName).toBeDefined();
      await db.collection('auth_users').dropIndex(emailIndexName!);

      outputStartIndex = consoleOutput.length;
      verify = await runDbVerifyJson(
        testSetup.testDir,
        configPath,
        consoleOutput,
        outputStartIndex,
      );
      expect(verify.exitCode).toBe(1);
      expect(verify.parsed['ok']).toBe(false);
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

      const outputStartIndex = consoleOutput.length;
      const { exitCode, parsed } = await runDbVerifyJson(
        testSetup.testDir,
        configPath,
        consoleOutput,
        outputStartIndex,
      );
      expect(exitCode).toBe(0);
      expect(parsed['ok']).toBe(true);
      // Under the `observed` control policy the dropped collection warns but
      // does not fail: the failure lists stay empty (verify passes) AND the
      // warning is surfaced in the warnings channel — watch-without-failing,
      // not silent suppression.
      const schema = parsed['schema'] as {
        issues: readonly unknown[];
        warnings: { issues: readonly { path: readonly string[] }[] };
      };
      expect(schema.issues).toEqual([]);
      expect(schema.warnings.issues.some((w) => w.path.join('/').includes('legacy_jobs'))).toBe(
        true,
      );
    });
  });
});
