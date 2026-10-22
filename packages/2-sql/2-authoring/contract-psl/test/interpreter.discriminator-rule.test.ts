import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { fixtureInterpreterTypes } from './fixture-codec-descriptors';
import { fixtureDataTypeSupport } from './fixture-data-types';
import {
  createBuiltinLikeControlMutationDefaults,
  interpretSqlContract,
  modelsOf,
  postgresEnumInferenceCodecs,
  postgresScalarTypeDescriptors,
  postgresTarget,
  testEnumEntityContributions,
  testEnumPslBlockDescriptor,
} from './fixtures';

function interpret(schema: string) {
  return interpretSqlContract(schema, {
    target: postgresTarget,
    scalarColumnDescriptors: postgresScalarTypeDescriptors,
    composedExtensionContracts: new Map(),
    controlMutationDefaults: createBuiltinLikeControlMutationDefaults(),
    authoringContributions: {
      entityTypes: testEnumEntityContributions,
      field: {},
      type: {},
      pslBlockDescriptors: { enum: testEnumPslBlockDescriptor },
      dataTypes: fixtureDataTypeSupport.entries,
    },
    ...fixtureInterpreterTypes,
    createNamespace: createTestSqlNamespace,
    enumInferenceCodecs: postgresEnumInferenceCodecs,
    capabilities: { sql: { scalarList: true } },
  });
}

function diagnosticsOf(schema: string) {
  const result = interpret(schema);
  return result.ok
    ? []
    : result.failure.diagnostics.map(({ code, message }) => ({ code, message }));
}

/** A base `Task` whose discriminator field is declared as `kind`, and a variant `Bug` with the base value `value`. */
function hierarchy(kind: string, value = '"bug"', preamble = '') {
  return `${preamble}
model Task {
  id   Int @id @default(autoincrement())
  kind ${kind}

  @@discriminator(kind)
}

model Bug {
  severity String

  @@base(Task, ${value})
}
`;
}

describe('the discriminator rule in SQL PSL', () => {
  it('refuses an optional discriminator field', () => {
    expect(diagnosticsOf(hierarchy('String?'))).toEqual([
      {
        code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
        message:
          'Discriminator field "kind" on model "Task" must be required, but it is optional. Remove the "?"',
      },
    ]);
  });

  it('refuses a list discriminator field', () => {
    expect(diagnosticsOf(hierarchy('String[]'))).toEqual([
      {
        code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
        message:
          'Discriminator field "kind" on model "Task" must hold one value, but it is a list. Remove the "[]"',
      },
    ]);
  });

  it('refuses a discriminator field whose data type is not text', () => {
    expect(diagnosticsOf(hierarchy('Int', '"1"'))).toEqual([
      {
        code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
        message:
          'Discriminator field "kind" on model "Task" must be text, such as String, but is "Int"',
      },
    ]);
  });

  const kindEnum = 'enum Kind {\n  Bug = "bug"\n  Feature = "feature"\n}\n';

  it('accepts an enum-typed discriminator whose @@base values are members', () => {
    const result = interpret(hierarchy('Kind', '"bug"', kindEnum));
    expect(result.ok && modelsOf(result.value)['Task']?.variants).toEqual({
      bug: expect.objectContaining({ model: 'Bug' }),
    });
  });

  it('refuses a @@base value that is not a member of the enum typing the discriminator', () => {
    expect(diagnosticsOf(hierarchy('Kind', '"story"', kindEnum))).toEqual([
      {
        code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
        message:
          'Model "Bug" declares @@base value "story", which is not a member of enum "Kind", the type of discriminator field "Task.kind". Write one of: "bug", "feature"',
      },
    ]);
  });

  it('accepts a String discriminator', () => {
    const result = interpret(hierarchy('String'));
    expect(result.ok && modelsOf(result.value)['Task']?.discriminator).toEqual({ field: 'kind' });
  });
});
