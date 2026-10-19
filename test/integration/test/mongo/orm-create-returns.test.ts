import { defineContract } from '@internal/mongo/contract-builder';
import mongo from '@internal/mongo/runtime';
import { timeouts } from '@repo/test-utils';
import { type CommandStartedEvent, Long, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const contract = defineContract({}, ({ field, model }) => ({
  models: {
    Note: model('Note', {
      collection: 'notes',
      fields: {
        _id: field.objectId(),
        title: field.string(),
        size: field.int64(),
        raw: field.bson(),
      },
    }),
  },
}));

describe('Mongo create return values', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  const reads: string[] = [];

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      instanceOpts: [
        { launchTimeout: timeouts.spinUpMongoMemoryServer, storageEngine: 'wiredTiger' },
      ],
      replSet: { count: 3, storageEngine: 'wiredTiger' },
    });
    const uri = replSet.getUri('create_returns');
    const url = `${uri}${uri.includes('?') ? '&' : '?'}readPreference=secondary`;
    client = new MongoClient(url, { monitorCommands: true });
    client.on('commandStarted', (event: CommandStartedEvent) => {
      if (event.commandName === 'find' || event.commandName === 'aggregate') {
        reads.push(event.commandName);
      }
    });
    await client.connect();
  }, timeouts.spinUpMongoMemoryServer);

  afterAll(async () => {
    await client?.close();
    await replSet?.stop();
  }, timeouts.spinUpMongoMemoryServer);

  function database() {
    return mongo({ contract, mongoClient: client, dbName: 'create_returns' });
  }

  it('come from the written documents, with no read, so reads from a secondary cannot miss them', async () => {
    const db = database();
    reads.length = 0;
    const created = [];
    for (let i = 0; i < 30; i++) {
      created.push(
        await db.orm.notes.create({
          title: `n${i}`,
          size: BigInt(i),
          raw: { n: Long.fromNumber(i) },
        }),
      );
    }
    const many = await db.orm.notes
      .createAll(Array.from({ length: 2000 }, (_, i) => ({ title: `m${i}`, size: 1n, raw: i })))
      .toArray();

    expect(reads).toEqual([]);
    expect(created.map(({ title, size, raw }) => ({ title, size, raw }))).toEqual(
      Array.from({ length: 30 }, (_, i) => ({ title: `n${i}`, size: BigInt(i), raw: { n: i } })),
    );
    expect(created.every(({ _id }) => typeof _id === 'string' && _id.length === 24)).toBe(true);
    expect(many.map(({ title }) => title)).toEqual(Array.from({ length: 2000 }, (_, i) => `m${i}`));
  });
});
