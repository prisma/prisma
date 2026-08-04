import { Binary, Decimal128, Long, MongoClient, ObjectId, Timestamp } from 'mongodb';
import { describe, expect, it } from 'vitest';
import * as bsonExports from '../../src/exports/bson';

describe('@internal/mongo/bson re-export parity', () => {
  it('re-exports all named exports from the mongodb BSON surface', () => {
    const expectedKeys = [
      'Binary',
      'Decimal128',
      'Long',
      'MongoClient',
      'ObjectId',
      'Timestamp',
    ].sort();
    const actualKeys = Object.keys(bsonExports).sort();
    expect(actualKeys).toEqual(expectedKeys);
  });

  it('re-exports Binary', () => {
    expect(bsonExports.Binary).toBe(Binary);
  });

  it('re-exports Decimal128', () => {
    expect(bsonExports.Decimal128).toBe(Decimal128);
  });

  it('re-exports Long', () => {
    expect(bsonExports.Long).toBe(Long);
  });

  it('re-exports MongoClient', () => {
    expect(bsonExports.MongoClient).toBe(MongoClient);
  });

  it('re-exports ObjectId', () => {
    expect(bsonExports.ObjectId).toBe(ObjectId);
  });

  it('re-exports Timestamp', () => {
    expect(bsonExports.Timestamp).toBe(Timestamp);
  });
});
