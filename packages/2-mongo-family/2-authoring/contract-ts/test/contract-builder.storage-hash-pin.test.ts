import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import { describe, expect, it } from 'vitest';
import { defineContract, field, index, model } from '../src/contract-builder';

const mongoFamilyPack = {
  kind: 'family',
  id: 'mongo',
  familyId: 'mongo',
  version: '0.0.1',
} as const satisfies FamilyPackRef<'mongo'>;

const mongoTargetPack = {
  kind: 'target',
  id: 'mongo',
  familyId: 'mongo',
  targetId: 'mongo',
  version: '0.0.1',
  defaultNamespaceId: '__unbound__',
} as const satisfies TargetPackRef<'mongo', 'mongo'>;

// Pins the storageHash computed for a representative authored contract.
// The hash fingerprints the constructed storage body the builder feeds
// into computeStorageHash; a builder-internal refactor that drifts that
// input (key shape, normalization, canonicalization hooks) fails here
// instead of surfacing later as a fixtures:check diff.
describe('mongo builder storageHash pin', () => {
  it('computes the pinned hash for a representative contract', () => {
    const User = model('User', {
      collection: 'users',
      fields: {
        _id: field.objectId(),
        email: field.string(),
      },
      indexes: [index({ email: 1 }, { unique: true })],
    });

    const Post = model('Post', {
      collection: 'posts',
      fields: {
        _id: field.objectId(),
        authorId: field.objectId(),
        title: field.string(),
      },
    });

    const contract = defineContract({
      family: mongoFamilyPack,
      target: mongoTargetPack,
      models: { User, Post },
    });

    expect(String(contract.storage.storageHash)).toBe(
      'cf17fca6237ec7fc1703fb8bbfea0856e08b769868b3275b72ace8b8cdf0fb38',
    );
  });
});
