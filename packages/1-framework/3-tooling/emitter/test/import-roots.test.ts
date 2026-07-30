import { UNBOUND_NAMESPACE_ID } from '@prisma-next/framework-components/ir';
import {
  createImportSpecifierResolver,
  type ImportRoot,
  importedSpecifiers,
  internalImportRoot,
} from '@prisma-next/publish-surface/import-roots';
import { describe, expect, it } from 'vitest';
import { createMockSpi } from './mock-spi';
import { createTestContract, emit } from './utils';

const postgresFacade: ImportRoot = { mode: 'facade', facade: '@prisma/orm-postgres' };
const platform: ImportRoot = { mode: 'platform' };
const allRoots = [internalImportRoot, postgresFacade, platform];

const spi = createMockSpi();

const stack = {
  codecTypeImports: [
    {
      package: '@prisma-next/target-postgres/codec-types',
      named: 'CodecTypes',
      alias: 'PgCodecTypes',
    },
  ],
};

function contract() {
  return createTestContract({
    storage: {
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: {
          id: UNBOUND_NAMESPACE_ID,
          entries: {
            table: {
              user: {
                columns: { id: { nativeType: 'int4', codecId: 'sql/int@1', nullable: false } },
                primaryKey: { columns: ['id'] },
                uniques: [],
                indexes: [],
                foreignKeys: [],
              },
            },
          },
        },
      },
    },
  });
}

function emitFor(root: ImportRoot) {
  return emit(contract(), stack, spi, {
    resolveImportSpecifier: createImportSpecifierResolver(root),
  });
}

describe('import roots and contract identity', () => {
  it('leaves every contract hash unchanged across roots', async () => {
    const [internal, facade, decomposed] = await Promise.all(allRoots.map(emitFor));

    const identity = (result: Awaited<ReturnType<typeof emitFor>>) => ({
      storageHash: result.storageHash,
      executionHash: result.executionHash,
      profileHash: result.profileHash,
    });

    expect(identity(facade!)).toEqual(identity(internal!));
    expect(identity(decomposed!)).toEqual(identity(internal!));
  });

  it('leaves contract.json byte-identical across roots', async () => {
    const [internal, facade, decomposed] = await Promise.all(allRoots.map(emitFor));

    expect(facade?.contractJson).toBe(internal?.contractJson);
    expect(decomposed?.contractJson).toBe(internal?.contractJson);
  });

  it('rewrites only the import specifiers in contract.d.ts', async () => {
    const [internal, facade] = await Promise.all([internalImportRoot, postgresFacade].map(emitFor));
    const withoutImports = (source: string) =>
      source
        .split('\n')
        .filter((line) => !line.includes("from '"))
        .join('\n');

    expect(importedSpecifiers(facade?.contractDts ?? '')).not.toEqual(
      importedSpecifiers(internal?.contractDts ?? ''),
    );
    expect(withoutImports(facade?.contractDts ?? '')).toBe(
      withoutImports(internal?.contractDts ?? ''),
    );
  });

  it('emits today’s specifiers when no root is supplied', async () => {
    const withoutOption = await emit(contract(), stack, spi);
    const withInternalRoot = await emitFor(internalImportRoot);

    expect(withoutOption.contractDts).toBe(withInternalRoot.contractDts);
    expect(importedSpecifiers(withoutOption.contractDts).sort()).toEqual([
      '@prisma-next/contract/types',
      '@prisma-next/sql-contract/types',
      '@prisma-next/target-postgres/codec-types',
    ]);
  });
});
