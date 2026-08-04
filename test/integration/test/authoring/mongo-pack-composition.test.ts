import { defineContract, field, model } from '@internal/mongo/contract-builder';
import { describe, expect, it } from 'vitest';

describe('Mongo pack composition', () => {
  it('composes the official Mongo family and target packs with TS authoring', () => {
    const User = model('User', {
      collection: 'users',
      fields: {
        _id: field.objectId(),
        email: field.string(),
      },
    });

    const contract = defineContract({
      models: { User },
    });

    expect(contract).toMatchObject({
      targetFamily: 'mongo',
      target: 'mongo',
      roots: {
        users: { namespace: '__unbound__', model: 'User' },
      },
      storage: {
        namespaces: {
          __unbound__: {
            id: '__unbound__',
            entries: {
              collection: {
                users: {},
              },
            },
          },
        },
      },
    });
  });
});
