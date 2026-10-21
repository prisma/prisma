import { ListCollectionsCommand, MongoFieldFilter } from '@internal/mongo-query-ast/control';
import { describe, expect, it } from 'vitest';
import { createCollection } from '../src/core/migrations/migration-factories';
import {
  deserializeMongoOps,
  serializeMongoOps,
} from '../src/core/migrations/mongo-ops-serializer';

describe('the object a Mongo check names', () => {
  it('survives a round trip through ops.json', () => {
    const [op] = deserializeMongoOps(JSON.parse(serializeMongoOps([createCollection('orders')])));

    expect(op?.precheck.map(({ description, object }) => ({ description, object }))).toEqual([
      { description: 'collection orders does not exist', object: 'collection orders' },
    ]);
  });

  it('is left out when ops.json written before it does not carry it', () => {
    const written = JSON.parse(
      serializeMongoOps([
        {
          id: 'collection.orders.create',
          label: 'Create collection orders',
          operationClass: 'additive',
          precheck: [
            {
              description: 'collection orders does not exist',
              source: new ListCollectionsCommand(),
              filter: MongoFieldFilter.eq('name', 'orders'),
              expect: 'notExists',
            },
          ],
          execute: [],
          postcheck: [],
        },
      ]),
    );

    const [op] = deserializeMongoOps(written);

    expect(op?.precheck[0]).not.toHaveProperty('object');
  });
});
