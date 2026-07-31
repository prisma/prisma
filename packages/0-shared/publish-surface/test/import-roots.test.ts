import { describe, expect, it } from 'vitest';
import {
  buildOwnerIndex,
  createImportSpecifierResolver,
  createScaffoldSpecifierResolver,
  directDependencyShells,
  type ImportRoot,
  ImportRootError,
  importedSpecifiers,
  importRootForDependencies,
  internalImportRoot,
  platformEntrypointOf,
  resolveImportSpecifier,
  type ScaffoldImportRoot,
  transitiveImports,
} from '../src/import-roots';
import type { ShellDefinition, ShellName } from '../src/shells';

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
      ).toThrow(/has no name under @prisma\/orm-postgres/);
    });

    it('does not tell the reader to install the platform package instead', () => {
      // Under a facade the answer is never "add @prisma/orm-family-sql to your
      // dependencies" — that is the shape ADR 242 exists to prevent — so the
      // message says the facade has no name for the module.
      const message = (() => {
        try {
          resolveImportSpecifier('@prisma-next/family-sql', postgresFacade);
          return '';
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
      })();

      expect(message).toMatch(/does not republish @prisma\/orm-family-sql\/family/);
      expect(message).not.toMatch(/depend on directly/);
    });

    it('refuses another database facade', () => {
      expect(() => resolveImportSpecifier('@prisma-next/sqlite/migration', postgresFacade)).toThrow(
        ImportRootError,
      );
    });

    it('forwards a subpath-only re-export but not its bare package name', () => {
      // The facade forwards the target under `target/…` for subpaths only —
      // it publishes its own `./target` pack under that name — so the bare
      // package has no facade name and falls through to the target shell,
      // which a facade-only application does not install.
      expect(resolveImportSpecifier('@prisma-next/target-postgres/migration', postgresFacade)).toBe(
        '@prisma/orm-postgres/target/migration',
      );
      expect(() => resolveImportSpecifier('@prisma-next/target-postgres', postgresFacade)).toThrow(
        /has no name under @prisma\/orm-postgres/,
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

describe('importRootForDependencies', () => {
  it('reads the facade an application installed', () => {
    expect(importRootForDependencies(['@prisma/orm-postgres', 'pg', 'react'])).toEqual(
      postgresFacade,
    );
    expect(importRootForDependencies(['@prisma/orm-mongo'])).toEqual(mongoFacade);
  });

  it('ignores extension packs, which every root allows', () => {
    expect(
      importRootForDependencies(['@prisma/orm-postgres', '@prisma/orm-extension-pgvector']),
    ).toEqual(postgresFacade);
  });

  it('reads a decomposed install from the platform shells it names', () => {
    expect(
      importRootForDependencies(['@prisma/orm-framework', '@prisma/orm-target-postgres']),
    ).toEqual(platform);
  });

  it('prefers the facade when a project also names a platform shell', () => {
    // A facade's own dependencies are installable alongside it; the facade is
    // still the name the application should be emitted against.
    expect(importRootForDependencies(['@prisma/orm-postgres', '@prisma/orm-toolchain'])).toEqual(
      postgresFacade,
    );
  });

  it('falls back to the internal root when no published package is named', () => {
    expect(importRootForDependencies(['@prisma-next/postgres', 'pg'])).toEqual(internalImportRoot);
    expect(importRootForDependencies([])).toEqual(internalImportRoot);
  });

  it('refuses two facades, which no single generated file can be emitted for', () => {
    expect(() => importRootForDependencies(['@prisma/orm-postgres', '@prisma/orm-sqlite'])).toThrow(
      ImportRootError,
    );
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

describe('createScaffoldSpecifierResolver', () => {
  const postgresScaffold: ScaffoldImportRoot = { mode: 'facade', facade: '@prisma/orm-postgres' };

  it('resolves the roots a scaffold can express', () => {
    expect(createScaffoldSpecifierResolver(internalImportRoot)('@prisma-next/postgres')).toBe(
      '@prisma-next/postgres',
    );
    expect(createScaffoldSpecifierResolver(postgresScaffold)('@prisma-next/postgres/runtime')).toBe(
      '@prisma/orm-postgres/runtime',
    );
  });

  // A decomposed install has no facade wiring for a scaffold to name, so
  // `platform` is rejected where the resolver is built rather than when a
  // template happens to hit a name it cannot resolve.
  it('does not accept the platform root', () => {
    // @ts-expect-error `platform` is not a `ScaffoldImportRoot`.
    const rejected = createScaffoldSpecifierResolver(platform);

    expect(rejected).toBeTypeOf('function');
  });
});

describe('buildOwnerIndex', () => {
  const shell = (packages: ShellDefinition['packages']): ShellDefinition => ({
    dir: 'packages/9-public/@prisma/orm-framework',
    kind: 'platform',
    packages,
  });

  it('indexes each package against the shell that publishes it', () => {
    const index = buildOwnerIndex(
      new Map<ShellName, ShellDefinition>([
        ['@prisma/orm-framework', shell([{ dir: 'a', name: '@prisma-next/a', entry: 'a' }])],
        ['@prisma/orm-family-sql', shell([{ dir: 'b', name: '@prisma-next/b', entry: '' }])],
      ]),
    );

    expect(index.get('@prisma-next/a')).toEqual({ shell: '@prisma/orm-framework', entry: 'a' });
    expect(index.get('@prisma-next/b')).toEqual({ shell: '@prisma/orm-family-sql', entry: '' });
  });

  it('refuses a package claimed by two shells, which would publish it twice', () => {
    const duplicated = new Map<ShellName, ShellDefinition>([
      ['@prisma/orm-framework', shell([{ dir: 'a', name: '@prisma-next/a', entry: 'a' }])],
      ['@prisma/orm-family-sql', shell([{ dir: 'a2', name: '@prisma-next/a', entry: 'a' }])],
    ]);

    expect(() => buildOwnerIndex(duplicated)).toThrow(ImportRootError);
    expect(() => buildOwnerIndex(duplicated)).toThrow(
      /@prisma-next\/a is mapped to both @prisma\/orm-framework and @prisma\/orm-family-sql/,
    );
  });
});

describe('importedSpecifiers', () => {
  it('finds every form generated code names a module with', () => {
    const source = [
      "import type { Contract } from '@prisma-next/contract/types';",
      'import {',
      '  Migration,',
      "} from '@prisma-next/postgres/migration';",
      `import Other from "@prisma-next/double-quoted";`,
      "import '@prisma-next/side-effect';",
      "type Ref = import('@prisma-next/inline-type').Thing;",
      "export { x } from '@prisma-next/re-exported';",
      'import endContract from \'../../snapshots/abc/contract.json\' with { type: "json" };',
    ].join('\n');

    expect(importedSpecifiers(source)).toEqual([
      '@prisma-next/contract/types',
      '@prisma-next/postgres/migration',
      '@prisma-next/double-quoted',
      '@prisma-next/side-effect',
      '@prisma-next/inline-type',
      '@prisma-next/re-exported',
      '../../snapshots/abc/contract.json',
    ]);
  });

  it('finds nothing in a source with no imports', () => {
    expect(importedSpecifiers('export type Contract = { readonly a: 1 };')).toEqual([]);
  });

  it('ignores quoted strings that are data rather than module names', () => {
    // The emitted `contract.d.ts` mirrors `contract.json`'s extensions block,
    // which carries `package: '@prisma-next/…'` as a string literal type. It
    // is contract data, not an import, and must not be rewritten or audited.
    const source = "export type X = { readonly package: '@prisma-next/extension-pgvector' };";

    expect(importedSpecifiers(source)).toEqual([]);
  });
});

describe('transitiveImports', () => {
  const importing = (...specifiers: string[]) =>
    specifiers.map((s) => `import { x } from '${s}';`).join('\n');

  it('reports nothing when every import is a direct dependency', () => {
    const clean = importing(
      '@prisma/orm-postgres/family-contract/types',
      '@prisma/orm-extension-pgvector/codec-types',
    );

    expect(transitiveImports(clean, postgresFacade)).toEqual([]);
  });

  it('reports a published package the application does not install directly', () => {
    const leaky = importing(
      '@prisma/orm-postgres/contract/types',
      '@prisma/orm-family-sql/contract/types',
      '@prisma/orm-toolchain/cli/migration-cli',
    );

    expect(transitiveImports(leaky, postgresFacade)).toEqual([
      '@prisma/orm-family-sql/contract/types',
      '@prisma/orm-toolchain/cli/migration-cli',
    ]);
  });

  it('reports a facade under the platform root, which a decomposed install lacks', () => {
    const leaky = importing(
      '@prisma/orm-family-sql/contract/types',
      '@prisma/orm-postgres/migration',
    );

    expect(transitiveImports(leaky, platform)).toEqual(['@prisma/orm-postgres/migration']);
  });

  it('reports an internal name that escaped rewriting', () => {
    const leaky = importing(
      '@prisma/orm-postgres/contract/types',
      '@prisma-next/sql-contract/types',
    );

    expect(transitiveImports(leaky, postgresFacade)).toEqual(['@prisma-next/sql-contract/types']);
  });

  it('reports a side-effect import, which has no `from` clause to scan', () => {
    const leaky = "import '@prisma/orm-family-sql/runtime';";

    expect(transitiveImports(leaky, postgresFacade)).toEqual(['@prisma/orm-family-sql/runtime']);
  });

  it('leaves relative paths and third-party packages alone', () => {
    const source = importing('./contract', '../../snapshots/abc/contract.json', 'arktype', 'pg');

    expect(transitiveImports(source, platform)).toEqual([]);
  });

  it('reports nothing under the internal root, whose names are the repository’s own', () => {
    expect(
      transitiveImports(importing('@prisma-next/sql-contract/types'), internalImportRoot),
    ).toEqual([]);
  });

  it('refuses a source whose imports it could not read rather than call it clean', () => {
    // A renderer that started quoting with backticks would otherwise make
    // every audited file look import-free, and the audit would pass on
    // output nobody had checked.
    const unscannable = 'import { Migration } from `@prisma-next/postgres/migration`;';

    expect(() => transitiveImports(unscannable, postgresFacade)).toThrow(ImportRootError);
    expect(() => transitiveImports(unscannable, postgresFacade)).toThrow(/pass vacuously/);
  });

  it('accepts a genuinely import-free source', () => {
    expect(transitiveImports('export type X = 1;', postgresFacade)).toEqual([]);
  });
});
