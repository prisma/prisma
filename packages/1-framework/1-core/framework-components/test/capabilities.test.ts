import { describe, expect, it } from 'vitest';
import { mergeCapabilityMatrices } from '../src/shared/capabilities';

describe('mergeCapabilityMatrices', () => {
  it('returns a fresh structurally-equal copy of base when contributors is empty', () => {
    const base = { sql: { returning: true } };

    const result = mergeCapabilityMatrices(base, []);

    expect(result).toEqual(base);
    expect(result).not.toBe(base);
    expect(result['sql']).not.toBe(base.sql);
  });

  it('merges a single contributor into an empty base', () => {
    const result = mergeCapabilityMatrices({}, [{ capabilities: { sql: { returning: true } } }]);

    expect(result).toEqual({ sql: { returning: true } });
  });

  it('merges a single contributor with disjoint namespaces', () => {
    const result = mergeCapabilityMatrices({ sql: { select: true } }, [
      { capabilities: { postgres: { lateral: true } } },
    ]);

    expect(result).toEqual({
      postgres: { lateral: true },
      sql: { select: true },
    });
  });

  it('contributor wins on key collision (later-wins, single contributor)', () => {
    const result = mergeCapabilityMatrices({ sql: { returning: false } }, [
      { capabilities: { sql: { returning: true } } },
    ]);

    expect(result).toEqual({ sql: { returning: true } });
  });

  it('second contributor wins when two contributors disagree on (namespace, key)', () => {
    const result = mergeCapabilityMatrices({}, [
      { capabilities: { sql: { returning: false } } },
      { capabilities: { sql: { returning: true } } },
    ]);

    expect(result).toEqual({ sql: { returning: true } });
  });

  it('skips contributors with no capabilities field', () => {
    const result = mergeCapabilityMatrices({ sql: { select: true } }, [
      {},
      { capabilities: { postgres: { lateral: true } } },
    ]);

    expect(result).toEqual({
      postgres: { lateral: true },
      sql: { select: true },
    });
  });

  it('skips contributors with null or non-object capabilities', () => {
    const result = mergeCapabilityMatrices({ sql: { select: true } }, [
      { capabilities: null },
      { capabilities: 'nope' },
      { capabilities: 42 },
      { capabilities: ['a', 'b'] },
      { capabilities: { postgres: { lateral: true } } },
    ]);

    expect(result).toEqual({
      postgres: { lateral: true },
      sql: { select: true },
    });
  });

  it('filters non-boolean leaves; namespace retained when any boolean leaf remains', () => {
    const result = mergeCapabilityMatrices({}, [
      {
        capabilities: {
          sql: { returning: 'yes' as unknown, lateral: true },
        },
      },
    ]);

    expect(result).toEqual({ sql: { lateral: true } });
  });

  it('omits namespace entirely when contributor leaves no boolean keys', () => {
    const result = mergeCapabilityMatrices({ sql: { select: true } }, [
      { capabilities: { postgres: { lateral: 'nope' as unknown } } },
    ]);

    expect(result).toEqual({ sql: { select: true } });
    expect(result).not.toHaveProperty('postgres');
  });

  it('tolerates a malformed base (non-object), returning the merged contributor matrix', () => {
    const result = mergeCapabilityMatrices(
      undefined as unknown as Record<string, Record<string, boolean>>,
      [{ capabilities: { sql: { returning: true } } }],
    );

    expect(result).toEqual({ sql: { returning: true } });
  });

  it('does not erase a base namespace when a later contributor has a non-object value there', () => {
    const result = mergeCapabilityMatrices({ sql: { select: true } }, [
      { capabilities: { sql: 'not-an-object' as unknown } },
    ]);

    expect(result).toEqual({ sql: { select: true } });
  });

  it('is idempotent when the same descriptor is passed twice', () => {
    const descriptor = { capabilities: { sql: { returning: true, lateral: true } } };

    const once = mergeCapabilityMatrices({}, [descriptor]);
    const twice = mergeCapabilityMatrices({}, [descriptor, descriptor]);

    expect(twice).toEqual(once);
  });

  it('sorts keys lexicographically at every level deterministically', () => {
    const result = mergeCapabilityMatrices({ zebra: { z: true }, alpha: { a: true } }, [
      { capabilities: { mid: { m: true, b: true, a: true } } },
    ]);

    expect(JSON.stringify(result)).toBe(
      JSON.stringify({
        alpha: { a: true },
        mid: { a: true, b: true, m: true },
        zebra: { z: true },
      }),
    );
  });

  it('does not mutate base or contributors (frozen inputs)', () => {
    const baseInner = Object.freeze({ select: true });
    const base = Object.freeze({ sql: baseInner });
    const contributorCaps = Object.freeze({ postgres: Object.freeze({ lateral: true }) });
    const contributor = Object.freeze({ capabilities: contributorCaps });

    const result = mergeCapabilityMatrices(base, [contributor]);

    expect(() => mergeCapabilityMatrices(base, [contributor])).not.toThrow();
    expect(result).not.toBe(base);
    expect(Object.isFrozen(result)).toBe(false);
    expect(base).toEqual({ sql: { select: true } });
    expect(contributorCaps).toEqual({ postgres: { lateral: true } });
  });
});
