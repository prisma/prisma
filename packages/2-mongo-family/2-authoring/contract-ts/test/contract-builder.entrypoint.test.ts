import type {
  ExtensionPackRef,
  FamilyPackRef,
  TargetPackRef,
} from '@internal/framework-components/components';
import { describe, expect, it } from 'vitest';
import { defineContract } from '../src/contract-builder';

const mongoFamilyPack = {
  kind: 'family',
  id: 'mongo',
  familyId: 'mongo',
  version: '0.0.1',
} as const satisfies FamilyPackRef<'mongo'>;

const sqlFamilyPack = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
} as const satisfies FamilyPackRef<'sql'>;

const mongoTargetPack = {
  kind: 'target',
  id: 'mongo',
  familyId: 'mongo',
  targetId: 'mongo',
  version: '0.0.1',
  defaultNamespaceId: '__unbound__',
} as const satisfies TargetPackRef<'mongo', 'mongo'>;

const vectorExtensionPack = {
  kind: 'extension',
  id: 'vector-search',
  familyId: 'mongo',
  targetId: 'mongo',
  version: '0.0.1',
} as const satisfies ExtensionPackRef<'mongo', 'mongo'>;

function unsafeExtensionPackRefForRuntimeTest<FamilyId extends string, TargetId extends string>(
  pack: FamilyPackRef<string> | TargetPackRef<string, string> | ExtensionPackRef<string, string>,
): ExtensionPackRef<FamilyId, TargetId> {
  return pack as unknown as ExtensionPackRef<FamilyId, TargetId>;
}

describe('defineContract runtime guards', () => {
  it.each([
    {
      name: 'non-Mongo family packs',
      run: () =>
        defineContract({
          family: sqlFamilyPack,
          target: mongoTargetPack,
          models: {},
        }),
      error: 'defineContract only accepts Mongo family packs. Received family "sql".',
      code: 'CONTRACT.PACK_FAMILY_MISMATCH',
    },
    {
      name: 'non-extension pack refs in extensions',
      run: () =>
        defineContract({
          family: mongoFamilyPack,
          target: mongoTargetPack,
          extensions: {
            invalid: unsafeExtensionPackRefForRuntimeTest(mongoTargetPack),
          },
          models: {},
        }),
      error:
        'defineContract only accepts extension pack refs in extensions. Received kind "target".',
      code: 'CONTRACT.PACK_REF_INVALID',
    },
    {
      name: 'extension packs from another family',
      run: () =>
        defineContract({
          family: mongoFamilyPack,
          target: mongoTargetPack,
          extensions: {
            invalid: unsafeExtensionPackRefForRuntimeTest({
              ...vectorExtensionPack,
              familyId: 'sql',
            }),
          },
          models: {},
        }),
      error:
        'extension pack "vector-search" targets family "sql" but contract target family is "mongo".',
      code: 'CONTRACT.PACK_FAMILY_MISMATCH',
    },
    {
      name: 'extension packs for another target',
      run: () =>
        defineContract({
          family: mongoFamilyPack,
          target: mongoTargetPack,
          extensions: {
            invalid: {
              ...vectorExtensionPack,
              targetId: 'atlas',
            },
          },
          models: {},
        }),
      error: 'extension pack "vector-search" targets "atlas" but contract target is "mongo".',
      code: 'CONTRACT.PACK_TARGET_MISMATCH',
    },
    {
      name: 'a non-object contract definition',
      run: () => defineContract(null as never),
      error: 'defineContract expects a contract definition object.',
      code: 'CONTRACT.ARGUMENT_INVALID',
    },
  ])('rejects $name', ({ run, error, code }) => {
    expect(run).toThrow(error);
    expect(run).toThrow(expect.objectContaining({ code }));
  });
});
