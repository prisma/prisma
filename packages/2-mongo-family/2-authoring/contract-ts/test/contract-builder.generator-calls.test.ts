import { gen } from '@internal/framework-components/authoring';
import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import { singleGeneratorBinding } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { defineContract, field, model } from '../src/contract-builder';

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
  generatorFunctions: [
    {
      name: 'now',
      signature: { documentation: 'now' },
      bindings: [
        singleGeneratorBinding({ codecIds: ['mongo/date@1'], generatorId: 'timestampNow' }),
      ],
    },
  ],
} as const satisfies TargetPackRef<'mongo', 'mongo'>;

const timestampNow = { kind: 'generator', id: 'timestampNow' } as const;

function contractWith(fields: Parameters<typeof model>[1]['fields']) {
  return defineContract({
    family: mongoFamilyPack,
    target: mongoTargetPack,
    models: {
      Post: model('Post', { collection: 'posts', fields: { _id: field.objectId(), ...fields } }),
    },
  });
}

describe('Mongo .onCreate and .onUpdate', () => {
  it('resolve now() on a date field for each phase, as temporal.updatedAt() does', () => {
    expect(
      contractWith({ updatedAt: field.date().onCreate(gen.now()).onUpdate(gen.now()) }).execution
        ?.mutations.defaults,
    ).toEqual([
      {
        ref: { namespace: UNBOUND_NAMESPACE_ID, entry: 'posts', field: 'updatedAt' },
        onCreate: timestampNow,
        onUpdate: timestampNow,
      },
    ]);
  });

  it('refuse a function the codec does not bind', () => {
    expect(() =>
      contractWith({ title: field.scalar('mongo/string@1').onCreate(gen.now()) }),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.DEFAULT_INVALID',
        meta: {
          modelName: 'Post',
          fieldName: 'title',
          codecId: 'mongo/string@1',
          function: 'now',
          reason: 'generator-not-applicable',
        },
      }),
    );
  });

  it('refuse a phase set twice', () => {
    expect(() => field.date().onUpdate(gen.now()).onUpdate(gen.now())).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.DEFAULT_INVALID',
        meta: { reason: 'generator-phase-set-twice', phase: 'onUpdate' },
      }),
    );
  });
});
