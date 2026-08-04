import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient, type Db } from '../src/db';
import { getAuthorLeaderboard } from '../src/queries';
import { seed } from '../src/seed';
import { mongoMemoryServerTimeoutMs } from './timeouts';

describe('mongo-blog-leaderboard', { timeout: mongoMemoryServerTimeoutMs }, () => {
  let replSet: MongoMemoryReplSet;
  let mongoClient: MongoClient;
  let db: Db;
  const dbName = 'blog_test';

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    mongoClient = new MongoClient(replSet.getUri());
    await mongoClient.connect();
    db = createClient({ url: replSet.getUri(), dbName });
  }, mongoMemoryServerTimeoutMs);

  beforeEach(async () => {
    await mongoClient.db(dbName).dropDatabase();
  });

  afterAll(async () => {
    await Promise.allSettled([db?.close(), mongoClient?.close(), replSet?.stop()]);
  }, mongoMemoryServerTimeoutMs);

  it('ranks authors by post count and embeds the user via $lookup', async () => {
    await seed(db.orm);

    const runtime = await db.runtime();
    const rows = await getAuthorLeaderboard(db, runtime);

    expect(rows).toHaveLength(3);

    expect(rows[0]).toMatchObject({ postCount: 3 });
    expect(rows[1]).toMatchObject({ postCount: 2 });
    expect(rows[2]).toMatchObject({ postCount: 1 });

    for (const row of rows) {
      expect(row.author).toHaveLength(1);
      expect(row.latestPost).toBeInstanceOf(Date);
    }

    const top = rows[0];
    if (!top) throw new Error('Expected top entry');
    const topAuthor = top.author[0];
    expect(topAuthor?.name).toBe('Alice Chen');
    expect(top.latestPost?.toISOString()).toBe(new Date('2026-04-05').toISOString());
  });

  it('returns an empty leaderboard when there are no posts', async () => {
    const runtime = await db.runtime();
    const rows = await getAuthorLeaderboard(db, runtime);
    expect(rows).toEqual([]);
  });
});
