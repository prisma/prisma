import { MongoContractView } from '@prisma/orm-mongo/family/ir';
import { timeouts } from '@repo/test-utils';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Contract } from '../src/contract';
import contractJson from '../src/contract.json' with { type: 'json' };

describe('migration', { timeout: timeouts.spinUpMongoMemoryServer }, () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  let db: Db;
  const dbName = 'migration_test';

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    client = new MongoClient(replSet.getUri());
    await client.connect();
    db = client.db(dbName);
  }, timeouts.spinUpMongoMemoryServer);

  afterAll(async () => {
    await Promise.allSettled([client?.close(), replSet?.stop()]);
  }, timeouts.spinUpMongoMemoryServer);

  it('contract contains expected index definitions', () => {
    const collections = MongoContractView.fromJson<Contract>(contractJson).collection;

    expect(collections.products.indexes).toMatchObject([
      {
        keys: [
          { field: 'name', direction: 'text' },
          { field: 'description', direction: 'text' },
        ],
        weights: { name: 10, description: 1 },
      },
      {
        keys: [
          { field: 'brand', direction: 1 },
          { field: 'subCategory', direction: 1 },
        ],
      },
      {
        keys: [
          { field: 'primaryCategory', direction: 1 },
          { field: 'articleType', direction: 1 },
        ],
      },
      { keys: [{ field: 'code', direction: 'hashed' }] },
    ]);

    expect(collections.users.indexes).toMatchObject([
      { keys: [{ field: 'email', direction: 1 }], unique: true },
    ]);

    expect(collections.carts.indexes).toMatchObject([
      { keys: [{ field: 'userId', direction: 1 }], unique: true },
    ]);

    expect(collections.orders.indexes).toMatchObject([
      { keys: [{ field: 'userId', direction: 1 }] },
    ]);

    expect(collections.events.indexes).toMatchObject([
      {
        keys: [
          { field: 'userId', direction: 1 },
          { field: 'timestamp', direction: -1 },
        ],
      },
      { keys: [{ field: 'timestamp', direction: 1 }], expireAfterSeconds: 7776000 },
    ]);

    expect(collections.invoices.indexes).toMatchObject([
      { keys: [{ field: 'orderId', direction: 1 }] },
      { keys: [{ field: 'issuedAt', direction: -1 }], sparse: true },
    ]);

    expect(collections.locations.indexes).toMatchObject([
      {
        keys: [
          { field: 'city', direction: 1 },
          { field: 'country', direction: 1 },
        ],
        collation: { locale: 'en', strength: 2 },
      },
    ]);
  });

  it('creates indexes on real MongoDB and verifies they exist', async () => {
    await db
      .collection('products')
      .createIndex(
        { name: 'text', description: 'text' },
        { weights: { name: 10, description: 1 } },
      );
    await db.collection('products').createIndex({ brand: 1, subCategory: 1 });
    await db.collection('products').createIndex({ primaryCategory: 1, articleType: 1 });
    await db.collection('products').createIndex({ code: 'hashed' });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('carts').createIndex({ userId: 1 }, { unique: true });
    await db.collection('orders').createIndex({ userId: 1 });
    await db.collection('events').createIndex({ userId: 1, timestamp: -1 });
    await db.collection('events').createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 });
    await db.collection('invoices').createIndex({ orderId: 1 });
    await db.collection('invoices').createIndex({ issuedAt: -1 }, { sparse: true });
    await db
      .collection('locations')
      .createIndex({ city: 1, country: 1 }, { collation: { locale: 'en', strength: 2 } });

    const productIndexes = await db.collection('products').indexes();
    expect(productIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { _fts: 'text', _ftsx: 1 },
          weights: { name: 10, description: 1 },
        }),
        expect.objectContaining({ key: { brand: 1, subCategory: 1 } }),
        expect.objectContaining({ key: { primaryCategory: 1, articleType: 1 } }),
        expect.objectContaining({ key: { code: 'hashed' } }),
      ]),
    );

    const userIndexes = await db.collection('users').indexes();
    expect(userIndexes).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: { email: 1 }, unique: true })]),
    );

    const eventIndexes = await db.collection('events').indexes();
    expect(eventIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { userId: 1, timestamp: -1 } }),
        expect.objectContaining({ key: { timestamp: 1 }, expireAfterSeconds: 7776000 }),
      ]),
    );

    const invoiceIndexes = await db.collection('invoices').indexes();
    expect(invoiceIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { orderId: 1 } }),
        expect.objectContaining({ key: { issuedAt: -1 }, sparse: true }),
      ]),
    );

    const locationIndexes = await db.collection('locations').indexes();
    expect(locationIndexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { city: 1, country: 1 },
          collation: expect.objectContaining({ locale: 'en', strength: 2 }),
        }),
      ]),
    );
  });
});
