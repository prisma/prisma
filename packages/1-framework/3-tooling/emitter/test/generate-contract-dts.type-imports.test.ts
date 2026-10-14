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

    expect(dts).toContain('readonly id: CodecOutputFor<"demo/char@1", { readonly length: 24 }>');
    expect(dts).toContain('type ParameterizedOutputTypeFunctions = DemoParameterizedOutputTypes;');
    expect(dts).toContain(
      'type CodecOutputFor<CodecId extends keyof CodecTypes, TypeParams extends Record<string, unknown>> = ParameterizedOutputType<ParameterizedOutputTypeFunctions, CodecId, TypeParams, CodecTypes[CodecId]["output"]>;',
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
    expect(dts).not.toMatch(/\bParameterizedOutputTypes\b/);
    expect(dts).not.toContain('DemoParameterizedOutputTypes');
  });
});

describe('generateContractDts for a family that types its fields with a generic', () => {
  const contract = createTestContract({
    namespaces: {
      public: {
        models: {
          User: {
            fields: {
              id: { nullable: false, type: { kind: 'scalar', codecId: 'demo/int@1' }, many: false },
              address: {
                nullable: true,
                type: { kind: 'valueObject', name: 'Address' },
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
  const spi = createMockSpi({
    fieldTypesExpression: (side) => `FieldTypesFrom<ContractBase, FieldTypeOverrides, '${side}'>`,
  });

  it('writes the field type maps as the family expression, over the type overrides it declares', () => {
    const dts = generateContractDts(contract, spi, [CODEC_TYPES], HASHES);

    expect(dts).toContain(
      'type FieldTypeOverrides = { readonly public: { readonly User: { readonly address: { readonly output: AddressOutput; readonly input: AddressInput } } } };',
    );
    expect(dts).toContain(
      "export type FieldOutputTypes = FieldTypesFrom<ContractBase, FieldTypeOverrides, 'output'>;",
    );
    expect(dts).toContain(
      "export type FieldInputTypes = FieldTypesFrom<ContractBase, FieldTypeOverrides, 'input'>;",
    );
  });

  it('types the fields of a Models member by indexing FieldOutputTypes', () => {
    const dts = generateContractDts(contract, spi, [CODEC_TYPES], HASHES);

    expect(dts).toContain('id: FieldOutputTypes["public"]["User"]["id"];');
    expect(dts).toContain('address: FieldOutputTypes["public"]["User"]["address"];');
  });
});

describe('generateContractDts for a family generic that names the type function union', () => {
  it('declares the union as never when the stack declares no type function', () => {
    const spi = createMockSpi({
      fieldTypesExpression: (side) =>
        `FieldTypesFrom<ContractBase, ParameterizedOutputTypeFunctions, '${side}'>`,
    });
    const dts = generateContractDts(createTestContract(), spi, [CODEC_TYPES], HASHES);

    expect(dts).toContain('type ParameterizedOutputTypeFunctions = never;');
  });
});
