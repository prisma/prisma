import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createDevDatabase, timeouts, withClient } from '@repo/test-utils';
import { MongoClient, ObjectId } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const execFileAsync = promisify(execFile);

describe('postgres bundle-size example', () => {
  let database: Awaited<ReturnType<typeof createDevDatabase>>;

  beforeAll(async () => {
    database = await createDevDatabase();
    // The example runs a single SELECT against `Note`. Create the table out
    // of band so we don't drag in the migration tooling — keeping the bundle
    // minimal is the whole point of this fixture.
    await withClient(database.connectionString, async (client) => {
      await client.query('CREATE TABLE "Note" ("id" text PRIMARY KEY)');
      await client.query(`INSERT INTO "Note" ("id") VALUES ('a'), ('b'), ('c')`);
    });
  });

  afterAll(async () => {
    await database?.close();
  });

  it.each([
    { label: 'no-emit (TS contract)', script: 'start:pg' },
    { label: 'emit (contract.json)', script: 'start:pg:emit' },
  ])('runs $label against a real Postgres and prints rows', async ({ script }) => {
    const { stdout } = await execFileAsync('pnpm', ['--silent', script], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: database.connectionString },
      timeout: 30_000,
    });

    const rows = JSON.parse(stdout) as Array<{ id: string }>;
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('mongo bundle-size example', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  const dbName = 'bundle_size_test';
  const ids = [new ObjectId(), new ObjectId(), new ObjectId()] as const;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    client = new MongoClient(replSet.getUri());
    await client.connect();
    // Seed the `notes` collection out of band; matches the postgres path.
    const notes = client.db(dbName).collection('notes');
    await notes.insertMany(ids.map((_id) => ({ _id })));
  }, timeouts.spinUpMongoMemoryServer);

  afterAll(async () => {
    await Promise.allSettled([client?.close(), replSet?.stop()]);
  }, timeouts.spinUpMongoMemoryServer);

  it.each([
    { label: 'no-emit (TS contract)', script: 'start:mongo' },
    { label: 'emit (contract.json)', script: 'start:mongo:emit' },
  ])('runs $label against a real Mongo and prints rows', async ({ script }) => {
    const { stdout } = await execFileAsync('pnpm', ['--silent', script], {
      cwd: root,
      env: {
        ...process.env,
        MONGODB_URL: replSet.getUri(),
        MONGODB_DB: dbName,
      },
      timeout: 30_000,
    });

    const rows = JSON.parse(stdout) as Array<{ _id: string }>;
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r._id).sort()).toEqual(ids.map((id) => id.toHexString()).sort());
  });
});
