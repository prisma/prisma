import {
  createImportSpecifierResolver,
  type ImportRoot,
  ImportRootError,
  importedSpecifiers,
  internalImportRoot,
  transitiveImports,
} from '@prisma-next/publish-surface/import-roots';
import { describe, expect, it } from 'vitest';
import { DropTableCall } from '../../src/core/migrations/op-factory-call';
import { renderCallsToTypeScript } from '../../src/core/migrations/render-typescript';

const sqliteFacade: ImportRoot = { mode: 'facade', facade: '@prisma/orm-sqlite' };
const platform: ImportRoot = { mode: 'platform' };

function render(root: ImportRoot): string {
  return renderCallsToTypeScript([new DropTableCall('stale')], {
    from: 'a'.repeat(64),
    to: 'b'.repeat(64),
    snapshotsImportPath: '../../snapshots',
    resolveImportSpecifier: createImportSpecifierResolver(root),
  });
}

/** Snapshot imports are relative paths, which no import root governs. */
function packageImports(source: string): string[] {
  return importedSpecifiers(source)
    .filter((specifier) => !specifier.startsWith('.'))
    .sort();
}

describe('emitted migration files under each import root', () => {
  it('names the workspace facade under the internal root', () => {
    expect(packageImports(render(internalImportRoot))).toEqual(['@prisma-next/sqlite/migration']);
  });

  it('names the published facade under the facade root', () => {
    expect(packageImports(render(sqliteFacade))).toEqual(['@prisma/orm-sqlite/migration']);
  });

  it('imports nothing the application would not depend on directly', () => {
    for (const root of [internalImportRoot, sqliteFacade]) {
      expect(transitiveImports(render(root), root)).toEqual([]);
    }
  });

  it('changes nothing but the import specifiers', () => {
    const withoutImports = (source: string) =>
      source
        .split('\n')
        .filter((line) => !line.includes("from '"))
        .join('\n');

    expect(withoutImports(render(sqliteFacade))).toEqual(
      withoutImports(render(internalImportRoot)),
    );
  });

  // Same shape as Postgres: the scaffold's one facade import merges symbols
  // from four packages, and a decomposed install has no facade to merge them.
  it('refuses the platform root, which has no facade to name', () => {
    expect(() => render(platform)).toThrow(ImportRootError);
  });
});
