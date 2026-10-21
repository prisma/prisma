import type { AuthoringContributions } from '@internal/framework-components/authoring';
import {
  type AnyCodecDescriptor,
  type CodecLookupWithDescriptors,
  createDataTypeLookup,
} from '@internal/framework-components/codec';
import { mongoDataType } from '@internal/mongo-contract/data-type';
import { mongoCodecLookup, mongoDataTypeLookup } from '@internal/mongo-contract/test';
import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { interpretMongoContract } from './interpreter-test-helpers';

const vector = mongoDataType('test/vector', {
  bsonTypes: ['array'],
  params: type({ 'length?': 'number.integer >= 1' }),
  read: (json) => json,
});

const codecLookup: CodecLookupWithDescriptors = {
  ...mongoCodecLookup,
  descriptorFor: (id) =>
    id === 'test/vector@1'
      ? ({ codecId: id, dataType: vector.id, traits: [] } as unknown as AnyCodecDescriptor)
      : mongoCodecLookup.descriptorFor(id),
};

const dataTypeLookup = createDataTypeLookup([vector]);

function vectorPreset(length: number): AuthoringContributions {
  return {
    field: {
      embedding: {
        kind: 'fieldPreset',
        output: { codecId: 'test/vector@1', typeParams: { length } },
      },
    },
  };
}

function interpret(length: number) {
  return interpretSchema(
    `model Doc {
  id     ObjectId    @id @map("_id")
  values embedding()
}
`,
    vectorPreset(length),
  );
}

function interpretSchema(schema: string, authoringContributions: AuthoringContributions) {
  return interpretMongoContract(schema, {
    scalarTypeCodecIds: new Map([['ObjectId', 'mongo/objectId@1']]),
    defaultFunctionRegistry: new Map(),
    codecLookup,
    dataTypes: {
      entries: {},
      lookup: {
        get: (id) => dataTypeLookup.get(id) ?? mongoDataTypeLookup.get(id),
        has: (id) => dataTypeLookup.has(id) || mongoDataTypeLookup.has(id),
      },
      dataTypeOfCodec: (codecId) => (codecId === 'test/vector@1' ? vector.id : undefined),
    },
    authoringContributions,
  });
}

describe('Mongo PSL field type parameters', () => {
  it('keeps type parameters the data type accepts', () => {
    const result = interpret(3);
    if (!result.ok) throw new Error(JSON.stringify(result.failure));
    expect(result.value.domain.namespaces['__unbound__']?.models['Doc']?.fields['values']).toEqual({
      nullable: false,
      many: false,
      type: { kind: 'scalar', codecId: 'test/vector@1', typeParams: { length: 3 } },
    });
  });

  it.each([0, -1, 2.5])('reports a length of %s as a diagnostic at the field', (length) => {
    const result = interpret(length);
    if (result.ok) throw new Error('Expected interpretation to fail');
    expect(result.failure.diagnostics).toEqual([
      expect.objectContaining({
        code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
        message: expect.stringMatching(
          /^Field "Doc\.values" uses field preset "embedding", whose type parameters are refused: test\/vector: length /,
        ),
        span: expect.objectContaining({ start: expect.any(Object) }),
      }),
    ]);
  });

  it('keeps the type parameters of a bare type constructor, on a field and through a types {} alias', () => {
    const result = interpretSchema(
      `types {
  Embedding = Vector3
}

model Doc {
  id      ObjectId  @id @map("_id")
  values  Vector3
  aliased Embedding
}
`,
      {
        type: {
          Vector3: {
            kind: 'typeConstructor',
            output: { codecId: 'test/vector@1', typeParams: { length: 3 } },
          },
        },
      },
    );
    if (!result.ok) throw new Error(JSON.stringify(result.failure));
    const vector3 = {
      nullable: false,
      many: false,
      type: { kind: 'scalar', codecId: 'test/vector@1', typeParams: { length: 3 } },
    };
    expect(result.value.domain.namespaces['__unbound__']?.models['Doc']?.fields).toEqual({
      id: { nullable: false, many: false, type: { kind: 'scalar', codecId: 'mongo/objectId@1' } },
      values: vector3,
      aliased: vector3,
    });
  });
});
