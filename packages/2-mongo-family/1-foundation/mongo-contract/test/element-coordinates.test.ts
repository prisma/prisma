import { coreHash } from '@internal/contract/types';
import { elementCoordinates, entityAt } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { buildMongoNamespace } from '../src/ir/build-mongo-namespace';
import { MongoStorage } from '../src/ir/mongo-storage';

describe('elementCoordinates with MongoStorage', () => {
  it('walks Mongo namespace collection entries', () => {
    const storage = new MongoStorage({
      storageHash: coreHash('element-coordinates-mongo'),
      namespaces: {
        app: buildMongoNamespace({ id: 'app', entries: { collection: { posts: {} } } }),
      },
    });

    const coordinates = [...elementCoordinates(storage)];
    expect(coordinates).toContainEqual({
      plane: 'storage',
      namespaceId: 'app',
      entityKind: 'collection',
      entityName: 'posts',
    });
  });
});

describe('coordinate-resolution acceptance — every elementCoordinates tuple resolves', () => {
  it('every coordinate from a mongo storage resolves through entityAt', () => {
    const storage = new MongoStorage({
      storageHash: coreHash('coord-resolution-mongo'),
      namespaces: {
        app: buildMongoNamespace({
          id: 'app',
          entries: { collection: { users: {}, posts: {}, comments: {} } },
        }),
        analytics: buildMongoNamespace({
          id: 'analytics',
          entries: { collection: { events: {} } },
        }),
      },
    });

    const coordinates = [...elementCoordinates(storage)];
    expect(coordinates.length).toBeGreaterThan(0);

    for (const coordinate of coordinates) {
      const entity = entityAt(storage, coordinate);
      expect(entity, `entityAt did not resolve ${JSON.stringify(coordinate)}`).toBeDefined();
    }
  });
});
