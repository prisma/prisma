import {
  assembleGeneratorFunctions,
  type DefaultFunctionLoweringContext,
  singleGeneratorBinding,
  type TypedDefaultFunctionCall,
} from '@internal/framework-components/control';
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
          generatorDescriptors: [{ id: 'slugid', applicableCodecIds: ['pg/text@1'] }],
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
          generatorDescriptors: [{ id: 'slugid', applicableCodecIds: ['pg/text@1'] }],
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

  describe('a generator function an extension contributes', () => {
    const slugidFunctions = assembleGeneratorFunctions([
      {
        id: 'slugid-pack',
        generatorFunctions: [
          {
            name: 'slugid',
            signature: { documentation: 'Generates a slug identifier when a value is omitted.' },
            bindings: [singleGeneratorBinding({ codecIds: ['pg/text@1'], generatorId: 'slugid' })],
          },
        ],
      },
    ]);
    const diagnosticsOf = (result: ReturnType<typeof interpretPostgresSchema>) =>
      result.ok ? [] : result.failure.diagnostics.map(({ code, message }) => ({ code, message }));

    it('is accepted in @onCreate', () => {
      const result = interpretPostgresSchema(
        `model User {
  id Int @id
  slug String @onCreate(slugid())
}
`,
        { generatorFunctions: slugidFunctions },
      );
      expect(result.ok && result.value.execution?.mutations.defaults).toEqual([
        {
          ref: { namespace: 'public', entry: 'User', field: 'slug' },
          onCreate: { kind: 'generator', id: 'slugid' },
        },
      ]);
    });

    it('is refused in @default, with the @onCreate form', () => {
      expect(
        diagnosticsOf(
          interpretPostgresSchema(
            `model User {
  id Int @id
  slug String @default(slugid())
}
`,
            { generatorFunctions: slugidFunctions },
          ),
        ),
      ).toEqual([
        {
          code: 'PSL_GENERATOR_IN_DEFAULT',
          message:
            'Field "User.slug": slugid() is a value the client generates, and @default sets a database default only. Write @onCreate(slugid()) instead.',
        },
      ]);
    });

    it('is refused on a codec it does not bind', () => {
      expect(
        diagnosticsOf(
          interpretPostgresSchema(
            `model User {
  id Int @id @onCreate(slugid())
}
`,
            { generatorFunctions: slugidFunctions },
          ),
        ),
      ).toEqual([
        {
          code: 'PSL_GENERATOR_NOT_APPLICABLE',
          message:
            'Field "User.id": slugid() does not apply to codec "pg/int4@1". No generator function applies to this codec.',
        },
      ]);
    });
  });
});
