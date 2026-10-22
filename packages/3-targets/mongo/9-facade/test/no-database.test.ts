import { MongoDriverImpl } from '@internal/driver-mongo';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineContract, field, model } from '../src/exports/contract-builder';
import mongo from '../src/runtime/mongo';

const Account = model('Account', {
  collection: 'accounts',
  fields: {
    _id: field.objectId(),
    email: field.string(),
  },
});

const contract = defineContract({ models: { Account } });

let fromConnection: ReturnType<typeof vi.spyOn>;
let fromDb: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fromConnection = vi.spyOn(MongoDriverImpl, 'fromConnection');
  fromDb = vi.spyOn(MongoDriverImpl, 'fromDb');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a mongo client with no database', () => {
  it('builds a plan from its query builder without creating a driver', () => {
    const db = mongo({ contract });

    const plan = db.query.from('accounts').sort({ email: 1 }).build();

    expect(plan.collection).toBe('accounts');
    expect(fromConnection).not.toHaveBeenCalled();
    expect(fromDb).not.toHaveBeenCalled();
  });
});

describe('a mongo client given a URL', () => {
  it('creates its driver on the first use', async () => {
    fromConnection.mockResolvedValue(
      Object.assign(Object.create(MongoDriverImpl.prototype), { close: async () => undefined }),
    );
    const db = mongo({ contract, url: 'mongodb://localhost:27017/app' });
    db.query.from('accounts').build();

    expect(fromConnection).not.toHaveBeenCalled();

    await db.runtime();
    await db.close();

    expect(fromConnection).toHaveBeenCalledTimes(1);
  });
});
