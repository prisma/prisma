import { describe, expect, it } from 'vitest';
import { mongoContractCanonicalizationHooks } from '../src/canonicalization-hooks';

const { shouldPreserveEmpty } = mongoContractCanonicalizationHooks;

describe('mongoContractCanonicalizationHooks.shouldPreserveEmpty', () => {
  it('preserves additionalProperties at the top level of a collection schema', () => {
    expect(
      shouldPreserveEmpty([
        'storage',
        'namespaces',
        'app',
        'entries',
        'collection',
        'users',
        'validator',
        'jsonSchema',
        'additionalProperties',
      ]),
    ).toBe(true);
  });

  it('preserves additionalProperties nested inside an embedded value object', () => {
    expect(
      shouldPreserveEmpty([
        'storage',
        'namespaces',
        'app',
        'entries',
        'collection',
        'users',
        'validator',
        'jsonSchema',
        'properties',
        'address',
        'additionalProperties',
      ]),
    ).toBe(true);
  });

  it('preserves additionalProperties inside a polymorphic oneOf branch', () => {
    expect(
      shouldPreserveEmpty([
        'storage',
        'namespaces',
        'app',
        'entries',
        'collection',
        'events',
        'validator',
        'jsonSchema',
        'oneOf',
        '0',
        'additionalProperties',
      ]),
    ).toBe(true);
  });

  it('preserves the empty collection slot', () => {
    expect(shouldPreserveEmpty(['storage', 'namespaces', 'app', 'entries', 'collection'])).toBe(
      true,
    );
  });

  it('does not preserve unrelated empty defaults', () => {
    expect(shouldPreserveEmpty(['storage', 'namespaces', 'app', 'somethingElse'])).toBe(false);
  });
});
