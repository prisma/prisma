import { buildEnumsMapForNamespace } from '@internal/contract/enum-accessor';
import { enumType } from '@internal/contract-authoring';
import {
  type AnyCodecDescriptor,
  type Codec,
  type CodecLookupWithDescriptors,
  createDataTypeLookup,
} from '@internal/framework-components/codec';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { mongoDataType } from '@internal/mongo-contract/data-type';
import { jsonValue, mapBlock } from '@internal/psl-parser';
import { describe, expect, it } from 'vitest';
import { mongoCodecLookup } from './derive-json-schema-helpers';
import { interpretMongoContract } from './interpreter-test-helpers';

const PREFIXED_CODEC_ID = 'test/prefixed@1';

const prefixedCodec = {
  id: PREFIXED_CODEC_ID,
  encode: async (v: unknown) => v,
  decode: async (w: unknown) => w,
  encodeJson: (v: unknown) => `s:${String(v)}`,
  decodeJson: (j: unknown) => String(j).slice('s:'.length),
} as unknown as Codec;

const codecLookup: CodecLookupWithDescriptors = {
  get: (id) => (id === PREFIXED_CODEC_ID ? prefixedCodec : mongoCodecLookup.get(id)),
  descriptorFor: (id) =>
    id === PREFIXED_CODEC_ID
      ? ({ codecId: id, dataType: 'test/prefixed' } as unknown as AnyCodecDescriptor)
      : mongoCodecLookup.descriptorFor(id),
  renderOutputTypeFor: () => undefined,
};

const dataTypeLookup = createDataTypeLookup([
  mongoDataType('mongo/objectid', { bsonTypes: ['objectId'] }),
  mongoDataType('test/prefixed', { bsonTypes: ['string'] }),
]);

function interpretPrefixedEnum() {
  const result = interpretMongoContract(
    `enum Status {
  Active = "active"
  Paused = "paused"
}

model Job {
  id     ObjectId @id @map("_id")
  status Status
}
`,
    {
      scalarTypeCodecIds: new Map([['ObjectId', 'mongo/objectId@1']]),
      defaultFunctionRegistry: new Map(),
      codecLookup,
      dataTypes: { entries: {}, lookup: dataTypeLookup },
      authoringContributions: {
        field: {},
        type: {},
        modelAttributes: {},
        entityTypes: {
          enum: {
            kind: 'entity',
            discriminator: 'enum',
            output: {
              factory: () =>
                enumType(
                  'Status',
                  { codecId: PREFIXED_CODEC_ID },
                  { name: 'Active', value: 'active' },
                  { name: 'Paused', value: 'paused' },
                ),
            },
          },
        },
        pslBlockDescriptors: {
          enum: {
            kind: 'pslBlock',
            keyword: 'enum',
            discriminator: 'enum',
            name: { required: true },
            spec: () =>
              mapBlock({
                value: { type: jsonValue(), documentation: 'The member value.' },
                allowBare: true,
              }),
          },
        },
      },
    },
  );
  if (!result.ok) throw new Error(JSON.stringify(result.failure));
  return result.value;
}

describe('Mongo PSL enum members', () => {
  it('are written in their stored form, the codec encodeJson of each decoded value', () => {
    const contract = interpretPrefixedEnum();
    const storage = contract.storage as unknown as {
      namespaces: Record<
        string,
        { entries: { valueSet: Record<string, { values: readonly unknown[] }> } }
      >;
    };

    expect({
      members: contract.domain.namespaces[UNBOUND_NAMESPACE_ID]?.enum?.['Status']?.members,
      valueSet: storage.namespaces[UNBOUND_NAMESPACE_ID]?.entries.valueSet['Status']?.values,
    }).toEqual({
      members: [
        { name: 'Active', value: 's:active' },
        { name: 'Paused', value: 's:paused' },
      ],
      valueSet: ['s:active', 's:paused'],
    });
  });

  it('decode back to the authored values through the enum accessor', () => {
    const contract = interpretPrefixedEnum();
    const enums = buildEnumsMapForNamespace(
      contract.domain,
      UNBOUND_NAMESPACE_ID,
      () => prefixedCodec,
    );

    expect(enums['Status']?.values).toEqual(['active', 'paused']);
  });
});
