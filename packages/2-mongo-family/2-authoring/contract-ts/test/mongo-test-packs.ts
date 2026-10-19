import type { AnyCodecDescriptor, Codec } from '@internal/framework-components/codec';
import { dataTypeId } from '@internal/framework-components/codec';
import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import { mongoTestCodecDescriptors, mongoTestDataTypes } from '@internal/mongo-contract/test';
import { blindCast } from '@internal/utils/casts';

export const mongoFamilyPack = {
  kind: 'family',
  id: 'mongo',
  familyId: 'mongo',
  version: '0.0.1',
} as const satisfies FamilyPackRef<'mongo'>;

export const mongoTargetPack = {
  kind: 'target',
  id: 'mongo',
  familyId: 'mongo',
  targetId: 'mongo',
  version: '0.0.1',
  defaultNamespaceId: '__unbound__',
  dataTypes: mongoTestDataTypes,
  types: { codecTypes: { codecDescriptors: mongoTestCodecDescriptors } },
} as const satisfies TargetPackRef<'mongo', 'mongo'>;

export function identityCodecDescriptor(codecId: string, dataType: string): AnyCodecDescriptor {
  return {
    codecId,
    dataType: dataTypeId(dataType),
    traits: ['equality'],
    paramsSchema: undefined,
    isParameterized: false,
    factory: () => () =>
      blindCast<Codec, 'an identity codec needs no other members in tests'>({
        id: codecId,
        encode: async (v: unknown) => v,
        decode: async (w: unknown) => w,
        encodeJson: (v: unknown) => v,
        decodeJson: (j: unknown) => j,
      }),
  };
}
