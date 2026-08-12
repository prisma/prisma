import {
  asNamespaceId,
  coreHash,
  profileHash,
  UNBOUND_DOMAIN_NAMESPACE_ID,
} from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { isStructuredError } from '@internal/utils/structured-error';
import { applicationDomainOf } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';

function crossRef(model: string, namespace: string = UNBOUND_DOMAIN_NAMESPACE_ID) {
  return { namespace: asNamespaceId(namespace), model };
}

import type { MongoContract, MongoModelDefinition } from '../src/contract-types';
import { buildMongoNamespace } from '../src/ir/build-mongo-namespace';
import { MongoCollection } from '../src/ir/mongo-collection';
import { MongoStorage } from '../src/ir/mongo-storage';
import { validateMongoStorage } from '../src/validate-storage';

const DUMMY_HASH = coreHash('test');

function storageWithItemsCollections(
  collections: Record<string, MongoCollection>,
): MongoContract['storage'] {
  return new MongoStorage({
    storageHash: DUMMY_HASH,
    namespaces: {
      [UNBOUND_NAMESPACE_ID]: buildMongoNamespace({
        id: UNBOUND_NAMESPACE_ID,
        entries: { collection: collections },
      }),
    },
  });
}

type MongoContractTestOverrides = Partial<MongoContract> & {
  models?: Record<string, MongoModelDefinition>;
};

function makeMinimalContract(overrides: MongoContractTestOverrides = {}): MongoContract {
  const { models, domain, ...rest } = overrides;
  const defaultModels: Record<string, MongoModelDefinition> = {
    Item: {
      fields: { _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false } },
      storage: { collection: 'items' },
      relations: {},
    },
  };
  return {
    target: 'mongo',
    targetFamily: 'mongo',
    roots: { items: crossRef('Item') },
    storage: storageWithItemsCollections({ items: new MongoCollection() }),
    domain: domain ?? applicationDomainOf({ models: models ?? defaultModels }),
    capabilities: {},
    extensions: {},
    profileHash: profileHash('test'),
    meta: {},
    ...rest,
  };
}

describe('validateMongoStorage()', () => {
  it('accepts a valid contract', () => {
    expect(() => validateMongoStorage(makeMinimalContract())).not.toThrow();
  });

  describe('embed relation targets', () => {
    it('rejects embed target with a collection', () => {
      const contract = makeMinimalContract({
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: {
              collection: 'items',
              relations: { tags: { field: 'tags' } },
            },
            relations: {
              tags: { to: crossRef('Tag'), cardinality: '1:N' as const },
            },
          },
          Tag: {
            fields: {
              name: { type: { kind: 'scalar', codecId: 'mongo/string@1' }, nullable: false },
            },
            storage: { collection: 'tags' },
            relations: {},
            owner: 'Item',
          },
        },
      });
      expect(() => validateMongoStorage(contract)).toThrow(/embed.*Tag.*must not.*collection/i);
    });

    it('validation failure raises CONTRACT.VALIDATION_FAILED', () => {
      const contract = makeMinimalContract({
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: {
              collection: 'items',
              relations: { tags: { field: 'tags' } },
            },
            relations: {
              tags: { to: crossRef('Tag'), cardinality: '1:N' as const },
            },
          },
          Tag: {
            fields: {
              name: { type: { kind: 'scalar', codecId: 'mongo/string@1' }, nullable: false },
            },
            storage: { collection: 'tags' },
            relations: {},
            owner: 'Item',
          },
        },
      });
      try {
        validateMongoStorage(contract);
        expect.fail('expected throw');
      } catch (e) {
        expect(isStructuredError(e)).toBe(true);
        if (!isStructuredError(e)) return;
        expect(e.code).toBe('CONTRACT.VALIDATION_FAILED');
      }
    });

    it('rejects embed target owned by a different model', () => {
      const contract = makeMinimalContract({
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: { collection: 'items' },
            relations: {
              tags: { to: crossRef('Tag'), cardinality: '1:N' as const },
            },
          },
          Other: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: { collection: 'items' },
            relations: {},
          },
          Tag: {
            fields: {
              name: { type: { kind: 'scalar', codecId: 'mongo/string@1' }, nullable: false },
            },
            storage: {},
            relations: {},
            owner: 'Other',
          },
        },
      });
      expect(() => validateMongoStorage(contract)).toThrow(
        /embed.*tags.*Tag.*owned by.*Other.*not.*Item/i,
      );
    });

    it('accepts embed target with empty storage', () => {
      const contract = makeMinimalContract({
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: {
              collection: 'items',
              relations: { tags: { field: 'tags' } },
            },
            relations: {
              tags: { to: crossRef('Tag'), cardinality: '1:N' as const },
            },
          },
          Tag: {
            fields: {
              name: { type: { kind: 'scalar', codecId: 'mongo/string@1' }, nullable: false },
            },
            storage: {},
            relations: {},
            owner: 'Item',
          },
        },
      });
      expect(() => validateMongoStorage(contract)).not.toThrow();
    });
  });

  describe('reference relation field existence', () => {
    it('rejects reference relation with localFields not in source model', () => {
      const contract = makeMinimalContract({
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: { collection: 'items' },
            relations: {
              owner: {
                to: crossRef('User'),
                cardinality: 'N:1' as const,
                on: { localFields: ['ownerId'], targetFields: ['_id'] },
              },
            },
          },
          User: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: { collection: 'users' },
            relations: {},
          },
        },
      });
      expect(() => validateMongoStorage(contract)).toThrow(
        /localField.*ownerId.*not.*field.*Item/i,
      );
    });

    it('rejects reference relation with targetFields not in target model', () => {
      const contract = makeMinimalContract({
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
              ownerId: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: { collection: 'items' },
            relations: {
              owner: {
                to: crossRef('User'),
                cardinality: 'N:1' as const,
                on: { localFields: ['ownerId'], targetFields: ['userId'] },
              },
            },
          },
          User: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: { collection: 'users' },
            relations: {},
          },
        },
      });
      expect(() => validateMongoStorage(contract)).toThrow(
        /targetField.*userId.*not.*field.*User/i,
      );
    });

    it('accepts reference relation with valid fields', () => {
      const contract = makeMinimalContract({
        storage: storageWithItemsCollections({
          items: new MongoCollection(),
          users: new MongoCollection(),
        }),
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
              ownerId: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: { collection: 'items' },
            relations: {
              owner: {
                to: crossRef('User'),
                cardinality: 'N:1' as const,
                on: { localFields: ['ownerId'], targetFields: ['_id'] },
              },
            },
          },
          User: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: { collection: 'users' },
            relations: {},
          },
        },
      });
      expect(() => validateMongoStorage(contract)).not.toThrow();
    });
  });

  describe('variant collection must match base', () => {
    it('rejects variant with a different collection than its base', () => {
      const contract = makeMinimalContract({
        storage: storageWithItemsCollections({
          items: new MongoCollection(),
          other: new MongoCollection(),
        }),
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
              type: { type: { kind: 'scalar', codecId: 'mongo/string@1' }, nullable: false },
            },
            storage: { collection: 'items' },
            relations: {},
            discriminator: { field: 'type' },
            variants: { SpecialItem: { value: 'special' } },
          },
          SpecialItem: {
            fields: {
              extra: { type: { kind: 'scalar', codecId: 'mongo/string@1' }, nullable: false },
            },
            storage: { collection: 'other' },
            relations: {},
            base: crossRef('Item'),
          },
        },
      });
      expect(() => validateMongoStorage(contract)).toThrow(
        /multi-table inheritance.*variant.*SpecialItem.*must share.*base.*collection/i,
      );
    });

    it('accepts variant with same collection as its base', () => {
      const contract = makeMinimalContract({
        storage: storageWithItemsCollections({ items: new MongoCollection() }),
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
              type: { type: { kind: 'scalar', codecId: 'mongo/string@1' }, nullable: false },
            },
            storage: { collection: 'items' },
            relations: {},
            discriminator: { field: 'type' },
            variants: { SpecialItem: { value: 'special' } },
          },
          SpecialItem: {
            fields: {
              extra: { type: { kind: 'scalar', codecId: 'mongo/string@1' }, nullable: false },
            },
            storage: { collection: 'items' },
            relations: {},
            base: crossRef('Item'),
          },
        },
      });
      expect(() => validateMongoStorage(contract)).not.toThrow();
    });
  });

  describe('collection-model consistency', () => {
    it('rejects model referencing a collection not declared in namespace collections', () => {
      const contract = makeMinimalContract({
        storage: storageWithItemsCollections({}),
        models: {
          Item: {
            fields: {
              _id: { type: { kind: 'scalar', codecId: 'mongo/objectId@1' }, nullable: false },
            },
            storage: { collection: 'items' },
            relations: {},
          },
        },
      });
      expect(() => validateMongoStorage(contract)).toThrow(
        /model.*Item.*collection.*items.*not declared/i,
      );
    });
  });
});
