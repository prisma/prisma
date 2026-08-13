import { timeouts } from '@repo/test-utils';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import stripAnsi from 'strip-ansi';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runOnEngine, setupTestDirectoryFromFixtures, withTempDir } from './utils/cli-test-helpers';

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
    it('returns JSON schema IR for Mongo database', async () => {
      const testSetup = setupTestDirectoryFromFixtures(
        createTempDir,
        'mongo-db-commands',
        'prisma.config.with-db.ts',
        { '{{MONGO_URI}}': mongoUri },
      );

      const run = await runOnEngine(testSetup, ['db', 'schema', '--json']);

      expect(run.exitCode).toBe(0);
      expect(run.presented?.data).toMatchObject({
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
        'prisma.config.with-db.ts',
        { '{{MONGO_URI}}': mongoUri },
      );

      const run = await runOnEngine(testSetup, ['db', 'schema']);

      expect(run.exitCode).toBe(0);
      expect(stripAnsi(`${run.stdout}\n${run.stderr}`)).toContain('users');
    });
  });
});
