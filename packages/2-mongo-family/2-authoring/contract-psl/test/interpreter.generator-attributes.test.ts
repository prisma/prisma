import {
  type AuthoringContributions,
  temporalAuthoringPresets,
} from '@internal/framework-components/authoring';
import {
  assembleGeneratorFunctions,
  singleGeneratorBinding,
} from '@internal/framework-components/components';
import { mongoCodecLookup } from '@internal/mongo-contract/test';
import { describe, expect, it } from 'vitest';
import { interpretMongoContract } from './interpreter-test-helpers';
import { mongoDataTypeSupport } from './mongo-type-lookups';

const generatorFunctions = assembleGeneratorFunctions([
  {
    id: 'mongo',
    generatorFunctions: [
      {
        name: 'now',
        signature: { documentation: 'Writes the current time.' },
        bindings: [
          singleGeneratorBinding({ codecIds: ['mongo/date@1'], generatorId: 'timestampNow' }),
        ],
      },
    ],
    controlMutationDefaults: { generatorDescriptors: [{ id: 'timestampNow' }] },
  },
]);

const authoringContributions: AuthoringContributions = {
  field: { temporal: temporalAuthoringPresets({ codecId: 'mongo/date@1' }) },
};

function interpret(schema: string) {
  return interpretMongoContract(schema, {
    scalarTypeCodecIds: new Map([
      ['ObjectId', 'mongo/objectId@1'],
      ['String', 'mongo/string@1'],
      ['DateTime', 'mongo/date@1'],
    ]),
    defaultFunctionRegistry: new Map(),
    generatorFunctions,
    codecLookup: mongoCodecLookup,
    dataTypes: mongoDataTypeSupport,
    authoringContributions,
  });
}

function diagnostics(schema: string) {
  const result = interpret(schema);
  if (result.ok) throw new Error('expected the schema to be refused');
  return result.failure.diagnostics.map(({ code, message }) => ({ code, message }));
}

const timestampNow = { kind: 'generator', id: 'timestampNow' } as const;

describe('Mongo PSL @onCreate and @onUpdate', () => {
  it('lower now() on DateTime to timestampNow for both phases', () => {
    const result = interpret(`model Post {
  id        ObjectId @id @map("_id")
  updatedAt DateTime @onCreate(now()) @onUpdate(now())
}`);
    expect(result.ok && result.value.execution?.mutations.defaults).toEqual([
      {
        ref: { namespace: '__unbound__', entry: 'Post', field: 'updatedAt' },
        onCreate: timestampNow,
        onUpdate: timestampNow,
      },
    ]);
  });

  it('refuse an optional field', () => {
    expect(
      diagnostics(`model Post {
  id     ObjectId  @id @map("_id")
  seenAt DateTime? @onUpdate(now())
}`),
    ).toEqual([
      {
        code: 'PSL_OPTIONAL_EXECUTION_DEFAULT_UNSUPPORTED',
        message:
          'Field "Post.seenAt" is optional, and a generated value needs a required field in MongoDB. Remove "?" or remove @onUpdate(...).',
      },
    ]);
  });

  it('refuse the same generator attribute twice on one field', () => {
    expect(
      diagnostics(`model Post {
  id     ObjectId @id @map("_id")
  seenAt DateTime @onUpdate(now()) @onUpdate(now())
}`),
    ).toEqual([
      {
        code: 'PSL_DUPLICATE_ATTRIBUTE',
        message: '`@onUpdate` declared more than once on field "Post.seenAt".',
      },
    ]);
  });

  it('refuse a variant field', () => {
    expect(
      diagnostics(`model Event {
  id   ObjectId @id @map("_id")
  kind String
  @@discriminator(kind)
}

model Click {
  seenAt DateTime @onCreate(now())
  @@base(Event, "click")
}`),
    ).toEqual([
      {
        code: 'PSL_PRESET_ON_VARIANT_FIELD',
        message:
          'Generated value on variant "Click" field "seenAt": execution defaults apply to every document in collection "Event", so declare them on the base model.',
      },
    ]);
  });

  it('refuse an attribute for a phase the preset already sets', () => {
    expect(
      diagnostics(`model Post {
  id        ObjectId             @id @map("_id")
  updatedAt temporal.updatedAt() @onUpdate(now())
}`),
    ).toEqual([
      {
        code: 'PSL_PRESET_AND_DEFAULT_CONFLICT',
        message:
          'Field "Post.updatedAt" uses a field-preset call that already generates a value on update, so @onUpdate(...) cannot set one too. Remove @onUpdate(...) or use a preset without an onUpdate generator.',
      },
    ]);
  });

  it('refuse a function the codec does not bind', () => {
    expect(
      diagnostics(`model Post {
  id   ObjectId @id @map("_id")
  name String   @onCreate(now())
}`),
    ).toEqual([
      {
        code: 'PSL_GENERATOR_NOT_APPLICABLE',
        message:
          'Field "Post.name": now() does not apply to codec "mongo/string@1". No generator function applies to this codec.',
      },
    ]);
  });

  it('name @onCreate(now()) when @default(now()) is written', () => {
    expect(
      diagnostics(`model Post {
  id        ObjectId @id @map("_id")
  createdAt DateTime @default(now())
}`),
    ).toEqual([
      {
        code: 'PSL_UNSUPPORTED_FIELD_ATTRIBUTE',
        message:
          'Field "Post.createdAt" uses unsupported attribute "@default". Use @onCreate(now()) instead; MongoDB has no database defaults.',
      },
    ]);
  });
});
