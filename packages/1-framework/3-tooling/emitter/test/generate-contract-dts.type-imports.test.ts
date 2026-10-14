import type { TypesImportSpec } from '@internal/framework-components/emission';
import { describe, expect, it } from 'vitest';
import { generateContractDts } from '../src/generate-contract-dts';
import { createMockSpi } from './mock-spi';
import { createTestContract } from './utils';

const HASHES = {
  storageHash: '0000000000000000000000000000000000000000000000000000000000000001',
  profileHash: '0000000000000000000000000000000000000000000000000000000000000002',
};

const CODEC_TYPES: TypesImportSpec = {
  package: '@internal/demo/codec-types',
  named: 'CodecTypes',
  alias: 'DemoTypes',
};

const VECTOR: TypesImportSpec = {
  package: '@internal/demo/codec-types',
  named: 'Vector',
  alias: 'Vector',
};

function importLines(dts: string): string {
  return dts.slice(0, dts.indexOf('export type'));
}

describe('generateContractDts codec type imports', () => {
  it('leaves out a helper type the contract does not use', () => {
    const dts = generateContractDts(
      createTestContract(),
      createMockSpi(),
      [CODEC_TYPES, VECTOR],
      HASHES,
    );

    expect(importLines(dts)).toContain('CodecTypes as DemoTypes');
    expect(importLines(dts)).not.toMatch(/\bVector\b/);
  });

  it('imports a helper type the contract uses', () => {
    const spi = createMockSpi({
      getStorageTypeExports: () => 'export type Embedding = Vector<3>;',
    });

    const dts = generateContractDts(createTestContract(), spi, [CODEC_TYPES, VECTOR], HASHES);

    expect(importLines(dts)).toMatch(/\bVector\b/);
  });
});

describe('generateContractDts parameterized output types', () => {
  const TYPE_FUNCTION: TypesImportSpec = {
    package: '@internal/demo/codec-types',
    named: 'ParameterizedOutputTypesForTypeParams',
    alias: 'DemoParameterizedOutputTypes',
  };
  const contractWithCharColumn = createTestContract({
    namespaces: {
      public: {
        models: {
          User: {
            fields: {
              id: {
                nullable: false,
                type: { kind: 'scalar', codecId: 'demo/char@1', typeParams: { length: 24 } },
                many: false,
              },
            },
            relations: {},
            storage: {},
          },
        },
      },
    },
  });
  const lookup = {
    get: () => undefined,
    renderOutputTypeFor: () => undefined,
    parameterizedOutputTypesFor: (id: string) => (id === 'demo/char@1' ? TYPE_FUNCTION : undefined),
  };

  it('declares the alias a column with type parameters is typed through, and imports what it names', () => {
    const dts = generateContractDts(
      contractWithCharColumn,
      createMockSpi(),
      [CODEC_TYPES],
      HASHES,
      { parameterizedOutputTypeImports: [TYPE_FUNCTION] },
      lookup,
    );

    expect(dts).toContain(
      'readonly id: ParameterizedOutput<"demo/char@1", { readonly length: 24 }>',
    );
    expect(dts).toContain(
      'type ParameterizedOutput<CodecId extends keyof CodecTypes, TypeParams extends Record<string, unknown>> = ParameterizedOutputType<DemoParameterizedOutputTypes, CodecId, TypeParams, CodecTypes[CodecId]["output"]>;',
    );
    expect(importLines(dts)).toContain(
      'ParameterizedOutputTypesForTypeParams as DemoParameterizedOutputTypes',
    );
    expect(importLines(dts)).toMatch(/\n {2}ParameterizedOutputType,\n/);
  });

  it('declares no alias and imports no type function when no column uses one', () => {
    const dts = generateContractDts(
      createTestContract(),
      createMockSpi(),
      [CODEC_TYPES],
      HASHES,
      { parameterizedOutputTypeImports: [TYPE_FUNCTION] },
      lookup,
    );

    expect(dts).not.toMatch(/\bParameterizedOutput\b/);
    expect(dts).not.toMatch(/\bParameterizedOutputType\b/);
    expect(dts).not.toContain('DemoParameterizedOutputTypes');
  });
});
