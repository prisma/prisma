import { computeStorageHash } from '@internal/contract/hashing';
import type { Codec, CodecLookup } from '@internal/framework-components/codec';
import { emptyCodecLookup } from '@internal/framework-components/codec';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { buildMongoStorage, encodeMongoEnum, mongoValueSetsOf } from '../src/build-mongo-storage';
import { mongoContractCanonicalizationHooks } from '../src/canonicalization-hooks';
import { MongoIndex } from '../src/ir/mongo-index';
import { MongoStorage } from '../src/ir/mongo-storage';

const upperCaseCodec = {
  encodeJson: (value: unknown) => String(value).toUpperCase(),
} as unknown as Codec;

const lookupWith = (codecs: Record<string, Codec>): CodecLookup => ({
  ...emptyCodecLookup,
  get: (id) => codecs[id],
});

const userIndex = new MongoIndex({ keys: [{ field: 'email', direction: 1 }], unique: true });

describe('encodeMongoEnum', () => {
  it('stores each member as its codec encodes it', () => {
    expect(
      encodeMongoEnum(
        {
          codecId: 'test/upper@1',
          members: [
            { name: 'Admin', value: 'admin' },
            { name: 'User', value: 'user' },
          ],
        },
        lookupWith({ 'test/upper@1': upperCaseCodec }),
      ),
    ).toEqual({
      codecId: 'test/upper@1',
      members: [
        { name: 'Admin', value: 'ADMIN' },
        { name: 'User', value: 'USER' },
      ],
    });
  });

  it('rejects an enum whose codec is not in the lookup', () => {
    expect(() =>
      encodeMongoEnum(
        { codecId: 'test/missing@1', members: [{ name: 'Admin', value: 'admin' }] },
        emptyCodecLookup,
      ),
    ).toThrow(expect.objectContaining({ code: 'CONTRACT.ENUM_CODEC_NOT_IN_PACK_STACK' }));
  });
});

describe('mongoValueSetsOf', () => {
  it("lists each enum's stored members as its value set", () => {
    expect(
      mongoValueSetsOf({
        Role: {
          codecId: 'test/upper@1',
          members: [
            { name: 'Admin', value: 'ADMIN' },
            { name: 'User', value: 'USER' },
          ],
        },
      }),
    ).toEqual({ Role: { kind: 'valueSet', values: ['ADMIN', 'USER'] } });
  });
});

describe('buildMongoStorage', () => {
  it('builds the unbound namespace from collections and value sets', () => {
    const storage = buildMongoStorage({
      collections: { users: { indexes: [userIndex] }, posts: {} },
      valueSets: { Role: { kind: 'valueSet', values: ['admin'] } },
    });
    expect(storage).toBeInstanceOf(MongoStorage);
    const entries = storage.namespaces[UNBOUND_NAMESPACE_ID]?.entries;
    expect(Object.keys(entries?.['collection'] ?? {})).toEqual(['users', 'posts']);
    expect(Object.keys(entries?.['valueSet'] ?? {})).toEqual(['Role']);
  });

  it('leaves out the value set entry when there are no value sets', () => {
    const storage = buildMongoStorage({ collections: { posts: {} }, valueSets: {} });
    expect(storage.namespaces[UNBOUND_NAMESPACE_ID]?.entries).not.toHaveProperty('valueSet');
  });

  it('hashes the constructed entries with the Mongo canonicalization hooks', () => {
    const storage = buildMongoStorage({
      collections: { users: { indexes: [userIndex] } },
      valueSets: { Role: { kind: 'valueSet', values: ['admin'] } },
    });
    const entries = storage.namespaces[UNBOUND_NAMESPACE_ID]?.entries;
    expect(storage.storageHash).toBe(
      computeStorageHash({
        target: 'mongo',
        targetFamily: 'mongo',
        storage: {
          namespaces: {
            [UNBOUND_NAMESPACE_ID]: {
              id: UNBOUND_NAMESPACE_ID,
              entries: { collection: entries?.['collection'], valueSet: entries?.['valueSet'] },
            },
          },
        },
        ...mongoContractCanonicalizationHooks,
      }),
    );
  });

  it('gives a different hash when an index changes', () => {
    const withIndex = buildMongoStorage({
      collections: { users: { indexes: [userIndex] } },
      valueSets: {},
    });
    const withoutIndex = buildMongoStorage({ collections: { users: {} }, valueSets: {} });
    expect(withIndex.storageHash).not.toBe(withoutIndex.storageHash);
  });
});
