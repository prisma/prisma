import { createDbSchemaCommand } from '@internal/cli/commands/db-schema';
import { timeouts } from '@repo/test-utils';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  executeCommand,
  setupCommandMocks,
  setupTestDirectoryFromFixtures,
  withTempDir,
} from './utils/cli-test-helpers';

function extractJson(lines: string[]): unknown {
  const joined = lines.join('\n');
  const start = joined.indexOf('{');
  const end = joined.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`No JSON object found in output:\n${joined}`);
  }
  return JSON.parse(joined.slice(start, end + 1));
}

describe('mongo db schema command (e2e)', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  let db: Db;
  let mongoUri: string;
  const dbName = 'schema_e2e_test';

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

  beforeAll(async () => {
    await db.createCollection('users');
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
  });

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
    let consoleErrors: string[] = [];
    let cleanupMocks: () => void = () => {};

    beforeEach(() => {
      const mocks = setupCommandMocks();
      consoleOutput = mocks.consoleOutput;
      consoleErrors = mocks.consoleErrors;
      cleanupMocks = mocks.cleanup;
    });

    afterEach(() => {
      cleanupMocks();
    });

    it('returns JSON schema IR for Mongo database', async () => {
      const testSetup = setupTestDirectoryFromFixtures(
        createTempDir,
        'mongo-db-commands',
        'prisma-next.config.with-db.ts',
        { '{{MONGO_URI}}': mongoUri },
      );

      const command = createDbSchemaCommand();
      const originalCwd = process.cwd();
      try {
        process.chdir(testSetup.testDir);
        await executeCommand(command, ['--config', testSetup.configPath, '--json', '--no-color']);
      } finally {
        process.chdir(originalCwd);
      }

      const allOutput = [...consoleOutput, ...consoleErrors];
      const parsed = extractJson(allOutput) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        ok: true,
        schema: {
          collections: expect.arrayContaining([
            expect.objectContaining({
              name: 'users',
              indexes: expect.arrayContaining([
                expect.objectContaining({
                  keys: [{ field: 'email', direction: 1 }],
                  unique: true,
                }),
              ]),
            }),
          ]),
        },
        target: {
          familyId: 'mongo',
        },
      });
    });

    it('renders tree output for Mongo database', async () => {
      const testSetup = setupTestDirectoryFromFixtures(
        createTempDir,
        'mongo-db-commands',
        'prisma-next.config.with-db.ts',
        { '{{MONGO_URI}}': mongoUri },
      );

      const command = createDbSchemaCommand();
      const originalCwd = process.cwd();
      try {
        process.chdir(testSetup.testDir);
        await executeCommand(command, ['--config', testSetup.configPath, '--no-color']);
      } finally {
        process.chdir(originalCwd);
      }

      const output = [...consoleOutput, ...consoleErrors].join('\n');
      expect(output).toContain('users');
    });
  });
});
