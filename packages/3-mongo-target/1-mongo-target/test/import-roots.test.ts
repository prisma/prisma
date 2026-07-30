import {
  createImportSpecifierResolver,
  type ImportRoot,
  ImportRootError,
  importedSpecifiers,
  internalImportRoot,
  transitiveImports,
} from '@prisma-next/publish-surface/import-roots';
import { describe, expect, it } from 'vitest';
import { CreateIndexCall } from '../src/core/op-factory-call';
import { renderCallsToTypeScript } from '../src/core/render-typescript';

const mongoFacade: ImportRoot = { mode: 'facade', facade: '@prisma/orm-mongo' };
const platform: ImportRoot = { mode: 'platform' };

function render(root: ImportRoot): string {
  return renderCallsToTypeScript(
    [new CreateIndexCall('users', [{ field: 'email', direction: 1 }], { unique: true })],
    {
      from: 'a'.repeat(64),
      to: 'b'.repeat(64),
      snapshotsImportPath: '../../snapshots',
      resolveImportSpecifier: createImportSpecifierResolver(root),
    },
  );
}

/** Snapshot imports are relative paths, which no import root governs. */
function packageImports(source: string): string[] {
  return importedSpecifiers(source)
    .filter((specifier) => !specifier.startsWith('.'))
    .sort();
}

describe('emitted migration files under each import root', () => {
  it('names workspace packages under the internal root', () => {
    expect(packageImports(render(internalImportRoot))).toEqual([
      '@prisma-next/cli/migration-cli',
      '@prisma-next/family-mongo/migration',
      '@prisma-next/target-mongo/migration',
    ]);
  });

  it('names the platform packages under the platform root', () => {
    expect(packageImports(render(platform))).toEqual([
      '@prisma/orm-family-mongo/family/migration',
      '@prisma/orm-target-mongo/target/migration',
      '@prisma/orm-toolchain/cli/migration-cli',
    ]);
  });

  it('imports nothing the application would not depend on directly', () => {
    for (const root of [internalImportRoot, platform]) {
      expect(transitiveImports(render(root), root)).toEqual([]);
    }
  });

  it('changes nothing but the import specifiers', () => {
    const withoutImports = (source: string) =>
      source
        .split('\n')
        .filter((line) => !line.includes("from '"))
        .join('\n');

    expect(withoutImports(render(platform))).toEqual(withoutImports(render(internalImportRoot)));
  });

  // Mongo is the mirror image of Postgres and SQLite: its scaffold already
  // names three platform packages directly instead of routing them through a
  // `@prisma-next/mongo/migration` facade entry, so the platform root works
  // and the facade root has nothing to point at — the Mongo facade
  // republishes the contract surfaces but not the family's migration base or
  // the CLI. Closing this needs either a facade `migration` entry mirroring
  // the SQL targets or two more facade re-exports; both change the published
  // facade surface, so TML-3126 decides.
  it('refuses the facade root, which the Mongo facade does not carry', () => {
    expect(() => render(mongoFacade)).toThrow(ImportRootError);
    expect(() => render(mongoFacade)).toThrow(/does not depend on directly/);
  });
});
