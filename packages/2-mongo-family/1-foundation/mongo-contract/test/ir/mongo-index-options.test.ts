import { IRNodeBase } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { MongoCollationOptions } from '../../src/ir/mongo-collation-options';
import { MongoIndexOptions } from '../../src/ir/mongo-index-options';

describe('MongoIndexOptions', () => {
  it('constructs empty (all fields optional)', () => {
    const opts = new MongoIndexOptions();
    expect(opts.kind).toBe('mongo-index-options');
    expect(opts.unique).toBeUndefined();
    expect(opts.sparse).toBeUndefined();
  });

  it('carries flat fields when provided', () => {
    const opts = new MongoIndexOptions({
      unique: true,
      sparse: true,
      expireAfterSeconds: 3600,
      name: 'idx_email',
    });
    expect(opts.unique).toBe(true);
    expect(opts.sparse).toBe(true);
    expect(opts.expireAfterSeconds).toBe(3600);
    expect(opts.name).toBe('idx_email');
  });

  it('normalises a collation data literal into a MongoCollationOptions instance', () => {
    const opts = new MongoIndexOptions({ unique: true, collation: { locale: 'en', strength: 2 } });
    expect(opts.collation).toBeInstanceOf(MongoCollationOptions);
    expect(opts.collation?.locale).toBe('en');
    expect(opts.collation?.strength).toBe(2);
  });

  it('preserves a collation class instance unchanged (identity equality)', () => {
    const collation = new MongoCollationOptions({ locale: 'en', strength: 2 });
    const opts = new MongoIndexOptions({ collation });
    expect(opts.collation).toBe(collation);
  });

  it('extends IRNodeBase and freezes', () => {
    const opts = new MongoIndexOptions({ unique: true });
    expect(opts).toBeInstanceOf(IRNodeBase);
    expect(opts).toBeInstanceOf(MongoIndexOptions);
    expect(Object.isFrozen(opts)).toBe(true);
  });

  it('round-trips through canonical JSON with kind included', () => {
    const opts = new MongoIndexOptions({
      unique: true,
      collation: { locale: 'en', strength: 2 },
    });
    expect(JSON.parse(JSON.stringify(opts))).toEqual({
      kind: 'mongo-index-options',
      unique: true,
      collation: { kind: 'mongo-collation-options', locale: 'en', strength: 2 },
    });
  });

  it('omits undefined optional fields from canonical JSON', () => {
    const opts = new MongoIndexOptions({ unique: true });
    const json = JSON.parse(JSON.stringify(opts)) as Record<string, unknown>;
    expect(json).toEqual({ kind: 'mongo-index-options', unique: true });
    expect(json).not.toHaveProperty('sparse');
    expect(json).not.toHaveProperty('collation');
  });

  it('preserves the 2dsphereIndexVersion bracketed-key field', () => {
    const opts = new MongoIndexOptions({ '2dsphereIndexVersion': 3 });
    expect(opts['2dsphereIndexVersion']).toBe(3);
    expect(JSON.parse(JSON.stringify(opts))).toEqual({
      kind: 'mongo-index-options',
      '2dsphereIndexVersion': 3,
    });
  });
});
