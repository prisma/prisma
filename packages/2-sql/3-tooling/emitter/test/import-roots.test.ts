import { generateContractDts } from '@prisma-next/emitter';
import type { TypesImportSpec } from '@prisma-next/framework-components/emission';
import {
  createImportSpecifierResolver,
  type ImportRoot,
  importedSpecifiers,
  internalImportRoot,
  transitiveImports,
} from '@prisma-next/publish-surface/import-roots';
import { describe, expect, it } from 'vitest';
import { sqlEmission } from '../src/index';
import { createEmitterTestContract as createContract } from './create-emitter-test-contract';

const postgresFacade: ImportRoot = { mode: 'facade', facade: '@prisma/orm-postgres' };
const platform: ImportRoot = { mode: 'platform' };

const hashes = { storageHash: 'storage', profileHash: 'profile' };

/**
 * Codec and operation type imports reach the emitted file from component
 * descriptors, so the audit has to include the target, adapter, and extension
 * packages a real stack contributes — not just the family contract.
 */
const codecTypeImports: TypesImportSpec[] = [
  {
    package: '@prisma-next/target-postgres/codec-types',
    named: 'CodecTypes',
    alias: 'PgCodecTypes',
  },
  {
    package: '@prisma-next/extension-pgvector/codec-types',
    named: 'CodecTypes',
    alias: 'PgVectorCodecTypes',
  },
];
const queryOperationTypeImports: TypesImportSpec[] = [
  {
    package: '@prisma-next/adapter-postgres/operation-types',
    named: 'QueryOperationTypes',
    alias: 'PgQueryOps',
  },
];

function emit(root: ImportRoot): string {
  const contract = createContract({
    models: {
      User: {
        storage: {
          namespaceId: '__unbound__',
          table: 'user',
          fields: { id: { column: 'id' } },
        },
        fields: {
          id: { nullable: false, type: { kind: 'scalar', codecId: 'sql/int@1' } },
        },
        relations: {},
      },
    },
    storage: {
      tables: {
        user: {
          columns: { id: { nativeType: 'int4', codecId: 'sql/int@1', nullable: false } },
          primaryKey: { columns: ['id'] },
          uniques: [],
          indexes: [],
          foreignKeys: [],
        },
      },
    },
  });
  return generateContractDts(
    contract,
    sqlEmission,
    codecTypeImports,
    hashes,
    { queryOperationTypeImports },
    undefined,
    createImportSpecifierResolver(root),
  );
}

describe('emitted contract types under each import root', () => {
  it('names workspace packages under the internal root', () => {
    expect(importedSpecifiers(emit(internalImportRoot)).sort()).toEqual([
      '@prisma-next/adapter-postgres/operation-types',
      '@prisma-next/contract/types',
      '@prisma-next/extension-pgvector/codec-types',
      '@prisma-next/sql-contract/types',
      '@prisma-next/target-postgres/codec-types',
    ]);
  });

  it('names the facade and the extension pack under the facade root', () => {
    expect(importedSpecifiers(emit(postgresFacade)).sort()).toEqual([
      '@prisma/orm-extension-pgvector/codec-types',
      '@prisma/orm-postgres/adapter/operation-types',
      '@prisma/orm-postgres/contract/types',
      '@prisma/orm-postgres/family-contract/types',
      '@prisma/orm-postgres/target/codec-types',
    ]);
  });

  it('names the platform packages under the platform root', () => {
    expect(importedSpecifiers(emit(platform)).sort()).toEqual([
      '@prisma/orm-extension-pgvector/codec-types',
      '@prisma/orm-family-sql/contract/types',
      '@prisma/orm-framework/contract/types',
      '@prisma/orm-target-postgres/adapter/operation-types',
      '@prisma/orm-target-postgres/target/codec-types',
    ]);
  });

  it('imports nothing the application would not depend on directly', () => {
    for (const root of [internalImportRoot, postgresFacade, platform]) {
      expect(transitiveImports(emit(root), root)).toEqual([]);
    }
  });

  it('emits the same contract identity whichever root it used', () => {
    const identityLines = (source: string) =>
      source.split('\n').filter((line) => line.includes('HashBase<'));

    expect(identityLines(emit(postgresFacade))).toEqual(identityLines(emit(internalImportRoot)));
    expect(identityLines(emit(platform))).toEqual(identityLines(emit(internalImportRoot)));
  });

  it('changes nothing but the import specifiers', () => {
    const withoutImports = (source: string) =>
      source
        .split('\n')
        .filter((line) => !line.includes("from '"))
        .join('\n');

    expect(withoutImports(emit(postgresFacade))).toEqual(withoutImports(emit(internalImportRoot)));
    expect(withoutImports(emit(platform))).toEqual(withoutImports(emit(internalImportRoot)));
  });
});
