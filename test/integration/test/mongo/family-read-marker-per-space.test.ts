import mongoAdapterDescriptor, { MongoControlAdapterImpl } from '@internal/adapter-mongo/control';
import mongoControlDriver, { MongoControlDriver } from '@internal/driver-mongo/control';
import { createMongoFamilyInstance, mongoFamilyDescriptor } from '@internal/family-mongo/control';
import { APP_SPACE_ID, createControlStack } from '@internal/framework-components/control';
import { mongoTargetDescriptor } from '@internal/target-mongo/control';
import { timeouts } from '@repo/test-utils';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const controlAdapter = new MongoControlAdapterImpl();

const EXT_SPACE = 'cipherstash';

describe('MongoFamilyInstance per-space readMarker', {
  timeout: timeouts.spinUpMongoMemoryServer,
}, () => {
  let replSet: MongoMemoryReplSet;
  let client: MongoClient;
  let db: Db;
  const dbName = 'family_per_space_readmarker_test';

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({
      instanceOpts: [
        { launchTimeout: timeouts.spinUpMongoMemoryServer, storageEngine: 'wiredTiger' },
      ],
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    client = new MongoClient(replSet.getUri());
    await client.connect();
    db = client.db(dbName);
  }, timeouts.spinUpMongoMemoryServer);

  afterAll(async () => {
    try {
      await client?.close();
      await replSet?.stop();
    } catch {
      // ignore
    }
  }, timeouts.spinUpMongoMemoryServer);

  beforeEach(async () => {
    await db.dropDatabase();
  });

  function makeFamily() {
    return createMongoFamilyInstance(
      createControlStack({
        family: mongoFamilyDescriptor,
        target: mongoTargetDescriptor,
        adapter: mongoAdapterDescriptor,
      }),
    );
  }

  it('returns the marker doc for an extension space', async () => {
    await controlAdapter.initMarker(new MongoControlDriver(db, client), EXT_SPACE, {
      storageHash: 'ext-storage',
      profileHash: 'ext-profile',
    });

    const driver = await mongoControlDriver.create(replSet.getUri(dbName));
    try {
      const family = makeFamily();
      const marker = await family.readMarker({ driver, space: EXT_SPACE });
      expect(marker).not.toBeNull();
      expect(marker?.storageHash).toBe('ext-storage');
      expect(marker?.profileHash).toBe('ext-profile');
    } finally {
      await driver.close();
    }
  });

  it('returns null when no marker exists for the extension space', async () => {
    const driver = await mongoControlDriver.create(replSet.getUri(dbName));
    try {
      const family = makeFamily();
      const marker = await family.readMarker({ driver, space: EXT_SPACE });
      expect(marker).toBeNull();
    } finally {
      await driver.close();
    }
  });

  it('readAllMarkers returns one entry per space', async () => {
    await controlAdapter.initMarker(new MongoControlDriver(db, client), APP_SPACE_ID, {
      storageHash: 'app-storage',
      profileHash: 'app-profile',
    });
    await controlAdapter.initMarker(new MongoControlDriver(db, client), EXT_SPACE, {
      storageHash: 'ext-storage',
      profileHash: 'ext-profile',
    });

    const driver = await mongoControlDriver.create(replSet.getUri(dbName));
    try {
      const family = makeFamily();
      const markers = await family.readAllMarkers({ driver });
      expect(markers.size).toBe(2);
      expect(markers.get(APP_SPACE_ID)?.storageHash).toBe('app-storage');
      expect(markers.get(EXT_SPACE)?.storageHash).toBe('ext-storage');
    } finally {
      await driver.close();
    }
  });

  it('readAllMarkers returns empty map when no markers written', async () => {
    const driver = await mongoControlDriver.create(replSet.getUri(dbName));
    try {
      const family = makeFamily();
      const markers = await family.readAllMarkers({ driver });
      expect(markers.size).toBe(0);
    } finally {
      await driver.close();
    }
  });
});
