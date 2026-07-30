import { describe, expect, it } from 'vitest';
import {
  createImportSpecifierResolver,
  directDependencyShells,
  type ImportRoot,
  ImportRootError,
  internalImportRoot,
  platformEntrypointOf,
  resolveImportSpecifier,
} from '../src/import-roots';

const postgresFacade: ImportRoot = { mode: 'facade', facade: '@prisma/orm-postgres' };
const mongoFacade: ImportRoot = { mode: 'facade', facade: '@prisma/orm-mongo' };
const platform: ImportRoot = { mode: 'platform' };

describe('resolveImportSpecifier', () => {
  describe('internal root', () => {
    it('returns every specifier unchanged', () => {
      for (const specifier of [
        '@prisma-next/sql-contract/types',
        '@prisma-next/contract/types',
        '@prisma-next/postgres/migration',
        '@prisma-next/family-mongo/migration',
      ]) {
        expect(resolveImportSpecifier(specifier, internalImportRoot)).toBe(specifier);
      }
    });
  });

  describe('facade root', () => {
    it('resolves the contract surfaces the facade republishes', () => {
      expect(resolveImportSpecifier('@prisma-next/sql-contract/types', postgresFacade)).toBe(
        '@prisma/orm-postgres/family-contract/types',
      );
      expect(resolveImportSpecifier('@prisma-next/contract/types', postgresFacade)).toBe(
        '@prisma/orm-postgres/contract/types',
      );
      expect(
        resolveImportSpecifier('@prisma-next/framework-components/emission', postgresFacade),
      ).toBe('@prisma/orm-postgres/components/emission');
      expect(
        resolveImportSpecifier('@prisma-next/target-postgres/codec-types', postgresFacade),
      ).toBe('@prisma/orm-postgres/target/codec-types');
      expect(
        resolveImportSpecifier('@prisma-next/adapter-postgres/operation-types', postgresFacade),
      ).toBe('@prisma/orm-postgres/adapter/operation-types');
    });

    it('resolves the facade package itself to the facade shell', () => {
      expect(resolveImportSpecifier('@prisma-next/postgres', postgresFacade)).toBe(
        '@prisma/orm-postgres',
      );
      expect(resolveImportSpecifier('@prisma-next/postgres/migration', postgresFacade)).toBe(
        '@prisma/orm-postgres/migration',
      );
      expect(resolveImportSpecifier('@prisma-next/mongo/runtime', mongoFacade)).toBe(
        '@prisma/orm-mongo/runtime',
      );
    });

    it('resolves an extension pack to its own package, which the application also installs', () => {
      expect(
        resolveImportSpecifier('@prisma-next/extension-pgvector/codec-types', postgresFacade),
      ).toBe('@prisma/orm-extension-pgvector/codec-types');
    });

    it('refuses a surface the facade does not republish', () => {
      expect(() =>
        resolveImportSpecifier('@prisma-next/cli/migration-cli', postgresFacade),
      ).toThrow(ImportRootError);
      expect(() =>
        resolveImportSpecifier('@prisma-next/cli/migration-cli', postgresFacade),
      ).toThrow(/does not depend on directly/);
    });

    it('refuses another database facade', () => {
      expect(() => resolveImportSpecifier('@prisma-next/sqlite/migration', postgresFacade)).toThrow(
        ImportRootError,
      );
    });

    it('rejects a non-facade shell as the facade', () => {
      expect(() =>
        resolveImportSpecifier('@prisma-next/sql-contract/types', {
          mode: 'facade',
          facade: '@prisma/orm-framework',
        }),
      ).toThrow(/is a platform shell, not a facade/);
    });
  });

  describe('platform root', () => {
    it('resolves each package to its own platform shell', () => {
      expect(resolveImportSpecifier('@prisma-next/sql-contract/types', platform)).toBe(
        '@prisma/orm-family-sql/contract/types',
      );
      expect(resolveImportSpecifier('@prisma-next/contract/types', platform)).toBe(
        '@prisma/orm-framework/contract/types',
      );
      expect(resolveImportSpecifier('@prisma-next/mongo-contract', platform)).toBe(
        '@prisma/orm-family-mongo/contract',
      );
      expect(resolveImportSpecifier('@prisma-next/target-postgres/codec-types', platform)).toBe(
        '@prisma/orm-target-postgres/target/codec-types',
      );
      expect(resolveImportSpecifier('@prisma-next/cli/migration-cli', platform)).toBe(
        '@prisma/orm-toolchain/cli/migration-cli',
      );
      expect(resolveImportSpecifier('@prisma-next/family-mongo/migration', platform)).toBe(
        '@prisma/orm-family-mongo/family/migration',
      );
    });

    it('refuses a per-database facade, which a decomposed install does not have', () => {
      expect(() => resolveImportSpecifier('@prisma-next/postgres/migration', platform)).toThrow(
        /@prisma\/orm-postgres\/migration, which an application on the platform import root does not depend on directly/,
      );
    });
  });

  it('leaves specifiers outside the internal scope alone', () => {
    for (const root of [postgresFacade, platform]) {
      expect(resolveImportSpecifier('./snapshots/abc/contract.json', root)).toBe(
        './snapshots/abc/contract.json',
      );
      expect(resolveImportSpecifier('node:crypto', root)).toBe('node:crypto');
      expect(resolveImportSpecifier('arktype', root)).toBe('arktype');
    }
  });

  it('refuses a specifier no shell maps', () => {
    expect(() => resolveImportSpecifier('@prisma-next/not-a-package', platform)).toThrow(
      /is not mapped to any published shell/,
    );
  });
});

describe('directDependencyShells', () => {
  it('is empty for the internal root, which names no published package', () => {
    expect(directDependencyShells(internalImportRoot).size).toBe(0);
  });

  it('is the chosen facade plus the extension packs', () => {
    expect([...directDependencyShells(postgresFacade)].sort()).toEqual([
      '@prisma/orm-extension-arktype-json',
      '@prisma/orm-extension-middleware-cache',
      '@prisma/orm-extension-paradedb',
      '@prisma/orm-extension-pgvector',
      '@prisma/orm-extension-postgis',
      '@prisma/orm-extension-supabase',
      '@prisma/orm-postgres',
    ]);
  });

  it('is every platform shell plus the extension packs, and no facade', () => {
    const shells = directDependencyShells(platform);

    expect(shells.has('@prisma/orm-family-sql')).toBe(true);
    expect(shells.has('@prisma/orm-toolchain')).toBe(true);
    expect(shells.has('@prisma/orm-extension-pgvector')).toBe(true);
    expect(shells.has('@prisma/orm-postgres')).toBe(false);
  });
});

describe('platformEntrypointOf', () => {
  it('reports the owning shell alongside the entrypoint', () => {
    expect(platformEntrypointOf('@prisma-next/sql-contract/types')).toEqual({
      shell: '@prisma/orm-family-sql',
      id: '@prisma/orm-family-sql/contract/types',
    });
  });

  it('drops the entry namespace for a package that occupies the shell itself', () => {
    expect(platformEntrypointOf('@prisma-next/postgres/migration')).toEqual({
      shell: '@prisma/orm-postgres',
      id: '@prisma/orm-postgres/migration',
    });
  });
});

describe('createImportSpecifierResolver', () => {
  it('is the identity for the internal root', () => {
    const resolve = createImportSpecifierResolver(internalImportRoot);

    expect(resolve('@prisma-next/sql-contract/types')).toBe('@prisma-next/sql-contract/types');
  });

  it('applies the root to each specifier it is handed', () => {
    const resolve = createImportSpecifierResolver(platform);

    expect(resolve('@prisma-next/sql-contract/types')).toBe(
      '@prisma/orm-family-sql/contract/types',
    );
  });
});
