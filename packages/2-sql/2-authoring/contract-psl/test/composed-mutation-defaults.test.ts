import type { DataTypeSupport } from '@internal/framework-components/authoring';
import { dataTypeId } from '@internal/framework-components/codec';
import type {
  DefaultFunctionLoweringContext,
  TypedDefaultFunctionCall,
} from '@internal/framework-components/control';
import { dataTypeValue, type FuncCallSig, leafDiagnostic, refineArg } from '@internal/psl-parser';
import { InternalError } from '@internal/utils/internal-error';
import { notOk, ok } from '@internal/utils/result';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import type { InterpretPslDocumentToSqlContractInput } from '../src/interpreter';
import { fixtureInterpreterTypes } from './fixture-codec-descriptors';
import { interpretSqlContract, postgresScalarTypeDescriptors, postgresTarget } from './fixtures';

describe('composed mutation default registries', () => {
  const interpretPostgresSchema = (
    schema: string,
    input: Omit<
      InterpretPslDocumentToSqlContractInput,
      | 'documents'
      | 'sources'
      | 'symbolTable'
      | 'binder'
      | 'target'
      | 'scalarColumnDescriptors'
      | 'composedExtensionContracts'
      | 'createNamespace'
      | 'capabilities'
      | 'dataTypes'
      | 'codecLookup'
    > &
      Partial<Pick<InterpretPslDocumentToSqlContractInput, 'composedExtensionContracts'>>,
  ) =>
    interpretSqlContract(schema, {
      target: postgresTarget,
      scalarColumnDescriptors: postgresScalarTypeDescriptors,
      composedExtensionContracts: new Map(),
      createNamespace: createTestSqlNamespace,
      ...fixtureInterpreterTypes,
      capabilities: { sql: { scalarList: true } },
      ...input,
    });

  it('rejects a default function call as invalid syntax when no components contribute handlers', () => {
    const result = interpretPostgresSchema(
      `model User {
  id Int @id
  externalId String @default(uuid())
}
`,
      {},
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.failure.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PSL_INVALID_ATTRIBUTE_SYNTAX',
          message: expect.stringContaining('Expected one of'),
        }),
      ]),
    );
  });

  it('accepts a function contributed through component composition', () => {
    const result = interpretPostgresSchema(
      `model User {
  id Int @id
  slug String @default(slugid())
}
`,
      {
        controlMutationDefaults: {
          defaultFunctionRegistry: new Map([
            [
              'slugid',
              {
                signature: {
                  documentation: 'Generates a slug identifier when a value is omitted.',
                },
                lower: (input: {
                  call: TypedDefaultFunctionCall;
                  context: DefaultFunctionLoweringContext;
                }) => {
                  void input;
                  return {
                    ok: true as const,
                    value: {
                      kind: 'execution' as const,
                      generated: {
                        kind: 'generator' as const,
                        id: 'slugid',
                      },
                    },
                  };
                },
                usageSignatures: ['slugid()'],
              },
            ],
          ]),
          generatorDescriptors: [{ id: 'slugid', applicableDataTypes: [dataTypeId('pg/text')] }],
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toMatchObject({
      execution: {
        mutations: {
          defaults: [
            {
              ref: { namespace: 'public', entry: 'User', field: 'slug' },
              onCreate: { kind: 'generator', id: 'slugid' },
            },
          ],
        },
      },
    });
  });

  describe('a registry with a signature written as an object and one built from the data types', () => {
    const generated = (id: string, params?: Record<string, unknown>) => ({
      ok: true as const,
      value: {
        kind: 'execution' as const,
        generated: { kind: 'generator' as const, id, ...(params ? { params } : {}) },
      },
    });
    const controlMutationDefaults = {
      defaultFunctionRegistry: new Map([
        [
          'slugid',
          {
            signature: { documentation: 'Generates a slug identifier.' },
            lower: () => generated('slugid'),
          },
        ],
        [
          'sizedid',
          {
            signature: (dataTypes: DataTypeSupport): FuncCallSig => ({
              documentation: 'Generates an identifier of a given size.',
              positional: [
                {
                  key: 'size',
                  type: refineArg(
                    dataTypeValue(dataTypeId('pg/int4'), dataTypes),
                    ({ value }, arg, ctx) =>
                      Number(value.value) === 4
                        ? ok(4)
                        : notOk([
                            leafDiagnostic(
                              ctx,
                              arg,
                              `sizedid: size must be 4, got ${String(value.value)}`,
                              'PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT',
                            ),
                          ]),
                  ),
                  documentation: 'The size.',
                },
              ],
            }),
            lower: ({ call }: { call: TypedDefaultFunctionCall }) =>
              generated('sizedid', { size: call.args['size'] }),
          },
        ],
      ]),
      generatorDescriptors: [
        { id: 'slugid', applicableDataTypes: [dataTypeId('pg/text')] },
        { id: 'sizedid', applicableDataTypes: [dataTypeId('pg/text')] },
      ],
    };

    it('lowers both functions', () => {
      const result = interpretPostgresSchema(
        `model User {
  id Int @id
  slug String @default(slugid())
  sized String @default(sizedid(4))
}
`,
        { controlMutationDefaults },
      );

      expect(result.ok ? result.value.execution?.mutations.defaults : result.failure).toEqual([
        {
          ref: { namespace: 'public', entry: 'User', field: 'sized' },
          onCreate: { kind: 'generator', id: 'sizedid', params: { size: 4 } },
        },
        {
          ref: { namespace: 'public', entry: 'User', field: 'slug' },
          onCreate: { kind: 'generator', id: 'slugid' },
        },
      ]);
    });

    it('reports the check of the built signature at the argument', () => {
      const result = interpretPostgresSchema(
        `model User {
  id Int @id
  sized String @default(sizedid(5))
}
`,
        { controlMutationDefaults },
      );

      expect(result.ok ? [] : result.failure.diagnostics).toEqual([
        {
          code: 'PSL_INVALID_DEFAULT_FUNCTION_ARGUMENT',
          message: 'sizedid: size must be 4, got 5',
          sourceId: 'schema.prisma',
          span: {
            start: { line: 3, column: 33, offset: 58 },
            end: { line: 3, column: 34, offset: 59 },
          },
        },
      ]);
    });
  });

  it('applies a generator to a column whose codec, from another pack, has a listed data type', () => {
    const textCodec = fixtureInterpreterTypes.codecLookup.descriptorFor('pg/text@1');
    if (textCodec === undefined) throw new Error('the fixture registers pg/text@1');
    const codecLookup = {
      ...fixtureInterpreterTypes.codecLookup,
      descriptorFor: (codecId: string) =>
        codecId === 'pack/slug@1'
          ? { ...textCodec, codecId }
          : fixtureInterpreterTypes.codecLookup.descriptorFor(codecId),
    };
    const result = interpretSqlContract(
      `model User {
  id Int @id
  slug Slug @default(slugid())
}
`,
      {
        target: postgresTarget,
        scalarColumnDescriptors: new Map([
          ...postgresScalarTypeDescriptors,
          ['Slug', { codecId: 'pack/slug@1' }],
        ]),
        composedExtensionContracts: new Map(),
        createNamespace: createTestSqlNamespace,
        ...fixtureInterpreterTypes,
        codecLookup,
        capabilities: { sql: { scalarList: true } },
        controlMutationDefaults: {
          defaultFunctionRegistry: new Map([
            [
              'slugid',
              {
                signature: { documentation: 'Generates a slug identifier.' },
                lower: () => ({
                  ok: true as const,
                  value: {
                    kind: 'execution' as const,
                    generated: { kind: 'generator' as const, id: 'slugid' },
                  },
                }),
              },
            ],
          ]),
          generatorDescriptors: [{ id: 'slugid', applicableDataTypes: [dataTypeId('pg/text')] }],
        },
      },
    );

    expect(result.ok ? result.value.execution?.mutations.defaults : result.failure).toEqual([
      {
        ref: { namespace: 'public', entry: 'User', field: 'slug' },
        onCreate: { kind: 'generator', id: 'slugid' },
      },
    ]);
  });

  it('throws an internal error when the column was resolved from a codec no descriptor is registered for', () => {
    const codecLookup = {
      ...fixtureInterpreterTypes.codecLookup,
      descriptorFor: (codecId: string) =>
        codecId === 'pg/text@1'
          ? undefined
          : fixtureInterpreterTypes.codecLookup.descriptorFor(codecId),
    };
    expect(() =>
      interpretSqlContract(
        `model User {
  id Int @id
  slug String @default(slugid())
}
`,
        {
          target: postgresTarget,
          scalarColumnDescriptors: postgresScalarTypeDescriptors,
          composedExtensionContracts: new Map(),
          createNamespace: createTestSqlNamespace,
          ...fixtureInterpreterTypes,
          codecLookup,
          capabilities: { sql: { scalarList: true } },
          controlMutationDefaults: {
            defaultFunctionRegistry: new Map([
              [
                'slugid',
                {
                  signature: { documentation: 'Generates a slug identifier.' },
                  lower: () => ({
                    ok: true as const,
                    value: {
                      kind: 'execution' as const,
                      generated: { kind: 'generator' as const, id: 'slugid' },
                    },
                  }),
                },
              ],
            ]),
            generatorDescriptors: [{ id: 'slugid', applicableDataTypes: [dataTypeId('pg/text')] }],
          },
        },
      ),
    ).toThrow(
      new InternalError(
        'Field "User.slug": no codec descriptor is registered for "pg/text@1", but the column was resolved from one.',
      ),
    );
  });

  it('emits applicability diagnostics for incompatible generator codec ids', () => {
    const result = interpretPostgresSchema(
      `model User {
  id Int @id @default(slugid())
}
`,
      {
        controlMutationDefaults: {
          defaultFunctionRegistry: new Map([
            [
              'slugid',
              {
                signature: { documentation: 'Generates a slug identifier for text fields.' },
                lower: () => ({
                  ok: true as const,
                  value: {
                    kind: 'execution' as const,
                    generated: {
                      kind: 'generator' as const,
                      id: 'slugid',
                    },
                  },
                }),
                usageSignatures: ['slugid()'],
              },
            ],
          ]),
          generatorDescriptors: [{ id: 'slugid', applicableDataTypes: [dataTypeId('pg/text')] }],
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.failure.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PSL_INVALID_DEFAULT_APPLICABILITY',
          message: expect.stringContaining('slugid'),
        }),
      ]),
    );
  });
});
