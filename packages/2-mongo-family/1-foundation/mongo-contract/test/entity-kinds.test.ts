import { hydrateNamespaceEntities } from '@internal/framework-components/ir';
import { isStructuredError } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import {
  collectionEntityKind,
  composeMongoEntityKinds,
  valueSetEntityKind,
} from '../src/entity-kinds';
import { MongoCollection } from '../src/ir/mongo-collection';
import { MongoValueSet } from '../src/ir/mongo-value-set';

const minimalCollectionInput = {};

describe('collectionEntityKind', () => {
  it('construct produces MongoCollection instances', () => {
    const result = collectionEntityKind.construct(minimalCollectionInput);
    expect(result).toBeInstanceOf(MongoCollection);
  });
});

describe('valueSetEntityKind', () => {
  it('construct produces MongoValueSet instances', () => {
    const result = valueSetEntityKind.construct({ kind: 'valueSet', values: ['admin', 'reader'] });
    expect(result).toBeInstanceOf(MongoValueSet);
    expect(result.values).toEqual(['admin', 'reader']);
  });
});

describe('composeMongoEntityKinds', () => {
  it('includes collection by default', () => {
    const kinds = composeMongoEntityKinds();
    expect(kinds.has('collection')).toBe(true);
  });

  it('includes valueSet by default', () => {
    const kinds = composeMongoEntityKinds();
    expect(kinds.has('valueSet')).toBe(true);
  });

  it('merges pack descriptors', () => {
    const synth = {
      kind: 'synthetic',
      schema: collectionEntityKind.schema,
      construct: (v: unknown) => v,
    };
    const kinds = composeMongoEntityKinds([synth]);
    expect(kinds.has('synthetic')).toBe(true);
  });

  it('throws on a duplicate entity kind', () => {
    const collide = {
      kind: 'collection',
      schema: collectionEntityKind.schema,
      construct: (v: unknown) => v,
    };
    expect(() => composeMongoEntityKinds([collide])).toThrow(/duplicate entity kind/);
  });

  it('duplicate entity kind raises CONTRACT.PACK_CONTRIBUTION_INVALID', () => {
    const collide = {
      kind: 'collection',
      schema: collectionEntityKind.schema,
      construct: (v: unknown) => v,
    };
    try {
      composeMongoEntityKinds([collide]);
      expect.fail('expected throw');
    } catch (e) {
      expect(isStructuredError(e)).toBe(true);
      if (!isStructuredError(e)) return;
      expect(e.code).toBe('CONTRACT.PACK_CONTRIBUTION_INVALID');
    }
  });
});

describe('hydrateNamespaceEntities with Mongo kinds (carry)', () => {
  it('constructs collection entries', () => {
    const kinds = composeMongoEntityKinds();
    const result = hydrateNamespaceEntities(
      { collection: { items: minimalCollectionInput } },
      kinds,
      'carry',
    );
    expect(result['collection']?.['items']).toBeInstanceOf(MongoCollection);
  });

  it('constructs valueSet entries from JSON', () => {
    const kinds = composeMongoEntityKinds();
    const result = hydrateNamespaceEntities(
      { collection: {}, valueSet: { Role: { kind: 'valueSet', values: ['admin', 'reader'] } } },
      kinds,
      'carry',
    );
    const roleVs = result['valueSet']?.['Role'];
    expect(roleVs).toBeInstanceOf(MongoValueSet);
    expect((roleVs as MongoValueSet).values).toEqual(['admin', 'reader']);
    expect(Object.isFrozen(roleVs)).toBe(true);
  });

  it('carries unknown kinds frozen as-is', () => {
    const kinds = composeMongoEntityKinds();
    const bogusMap = Object.freeze({ foo: { x: 1 } });
    const result = hydrateNamespaceEntities(
      { collection: {}, bogus: bogusMap } as Record<string, Record<string, unknown>>,
      kinds,
      'carry',
    );
    expect(result['bogus']).toBe(bogusMap);
    expect(Object.isFrozen(result['bogus'])).toBe(true);
  });

  it('throws for unknown kinds on fail mode', () => {
    const kinds = composeMongoEntityKinds();
    expect(() =>
      hydrateNamespaceEntities(
        { collection: {}, bogus: { x: {} } } as Record<string, Record<string, unknown>>,
        kinds,
        'fail',
        'ns-1',
      ),
    ).toThrow(/bogus/);
  });
});
