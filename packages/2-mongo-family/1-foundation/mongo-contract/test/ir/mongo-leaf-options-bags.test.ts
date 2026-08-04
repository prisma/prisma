import { IRNodeBase } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { MongoChangeStreamPreAndPostImagesOptions } from '../../src/ir/mongo-change-stream-pre-and-post-images-options';
import { MongoClusteredCollectionOptions } from '../../src/ir/mongo-clustered-collection-options';
import { MongoIndexOptionDefaults } from '../../src/ir/mongo-index-option-defaults';
import { MongoTimeSeriesCollectionOptions } from '../../src/ir/mongo-time-series-collection-options';

describe('MongoIndexOptionDefaults', () => {
  it('constructs empty (all fields optional)', () => {
    const opts = new MongoIndexOptionDefaults();
    expect(opts.kind).toBe('mongo-index-option-defaults');
    expect(opts.storageEngine).toBeUndefined();
  });

  it('carries storageEngine when provided', () => {
    const opts = new MongoIndexOptionDefaults({ storageEngine: { wiredTiger: { foo: 'bar' } } });
    expect(opts.storageEngine).toEqual({ wiredTiger: { foo: 'bar' } });
  });

  it('extends IRNodeBase and freezes', () => {
    const opts = new MongoIndexOptionDefaults();
    expect(opts).toBeInstanceOf(IRNodeBase);
    expect(Object.isFrozen(opts)).toBe(true);
  });

  it('omits undefined fields from canonical JSON', () => {
    const opts = new MongoIndexOptionDefaults();
    expect(JSON.parse(JSON.stringify(opts))).toEqual({ kind: 'mongo-index-option-defaults' });
  });
});

describe('MongoTimeSeriesCollectionOptions', () => {
  it('constructs with required timeField', () => {
    const opts = new MongoTimeSeriesCollectionOptions({ timeField: 'createdAt' });
    expect(opts.kind).toBe('mongo-time-series-collection-options');
    expect(opts.timeField).toBe('createdAt');
    expect(opts.metaField).toBeUndefined();
    expect(opts.granularity).toBeUndefined();
  });

  it('carries all optional fields when provided', () => {
    const opts = new MongoTimeSeriesCollectionOptions({
      timeField: 'ts',
      metaField: 'meta',
      granularity: 'minutes',
      bucketMaxSpanSeconds: 3600,
      bucketRoundingSeconds: 60,
    });
    expect(opts.metaField).toBe('meta');
    expect(opts.granularity).toBe('minutes');
    expect(opts.bucketMaxSpanSeconds).toBe(3600);
    expect(opts.bucketRoundingSeconds).toBe(60);
  });

  it('extends IRNodeBase and freezes', () => {
    const opts = new MongoTimeSeriesCollectionOptions({ timeField: 'ts' });
    expect(opts).toBeInstanceOf(IRNodeBase);
    expect(Object.isFrozen(opts)).toBe(true);
  });

  it('round-trips through canonical JSON with kind included', () => {
    const opts = new MongoTimeSeriesCollectionOptions({
      timeField: 'ts',
      granularity: 'hours',
    });
    expect(JSON.parse(JSON.stringify(opts))).toEqual({
      kind: 'mongo-time-series-collection-options',
      timeField: 'ts',
      granularity: 'hours',
    });
  });
});

describe('MongoClusteredCollectionOptions', () => {
  it('constructs with required key + unique', () => {
    const opts = new MongoClusteredCollectionOptions({ key: { _id: 1 }, unique: true });
    expect(opts.kind).toBe('mongo-clustered-collection-options');
    expect(opts.key).toEqual({ _id: 1 });
    expect(opts.unique).toBe(true);
    expect(opts.name).toBeUndefined();
  });

  it('carries name when provided', () => {
    const opts = new MongoClusteredCollectionOptions({
      name: 'primary',
      key: { _id: 1 },
      unique: true,
    });
    expect(opts.name).toBe('primary');
  });

  it('extends IRNodeBase and freezes', () => {
    const opts = new MongoClusteredCollectionOptions({ key: { _id: 1 }, unique: true });
    expect(opts).toBeInstanceOf(IRNodeBase);
    expect(Object.isFrozen(opts)).toBe(true);
  });

  it('round-trips through canonical JSON with kind included', () => {
    const opts = new MongoClusteredCollectionOptions({ key: { _id: 1 }, unique: false });
    expect(JSON.parse(JSON.stringify(opts))).toEqual({
      kind: 'mongo-clustered-collection-options',
      key: { _id: 1 },
      unique: false,
    });
  });
});

describe('MongoChangeStreamPreAndPostImagesOptions', () => {
  it('constructs with enabled flag', () => {
    const opts = new MongoChangeStreamPreAndPostImagesOptions({ enabled: true });
    expect(opts.kind).toBe('mongo-change-stream-pre-and-post-images-options');
    expect(opts.enabled).toBe(true);
  });

  it('extends IRNodeBase and freezes', () => {
    const opts = new MongoChangeStreamPreAndPostImagesOptions({ enabled: false });
    expect(opts).toBeInstanceOf(IRNodeBase);
    expect(Object.isFrozen(opts)).toBe(true);
  });

  it('round-trips through canonical JSON with kind included', () => {
    const opts = new MongoChangeStreamPreAndPostImagesOptions({ enabled: true });
    expect(JSON.parse(JSON.stringify(opts))).toEqual({
      kind: 'mongo-change-stream-pre-and-post-images-options',
      enabled: true,
    });
  });
});
