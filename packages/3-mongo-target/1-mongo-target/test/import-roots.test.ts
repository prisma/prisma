import {
  createImportSpecifierResolver,
  type ImportRoot,
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
  // One specifier, the way Postgres and SQLite scaffolds already read. The
  // `Migration` base and `MigrationCLI` reach the scaffold through the
  // target's own `migration` entry, so every name the scaffold carries
  // belongs to the same package and every root has something to map it to.
  it('names one workspace package under the internal root', () => {
    expect(packageImports(render(internalImportRoot))).toEqual([
      '@prisma-next/target-mongo/migration',
    ]);
  });

  it('names the published facade under the facade root', () => {
    expect(packageImports(render(mongoFacade))).toEqual(['@prisma/orm-mongo/target/migration']);
  });

  it('names the target package under the platform root', () => {
    expect(packageImports(render(platform))).toEqual(['@prisma/orm-target-mongo/target/migration']);
  });

  it('imports nothing the application would not depend on directly', () => {
    for (const root of [internalImportRoot, mongoFacade, platform]) {
      expect(transitiveImports(render(root), root)).toEqual([]);
    }
  });

  it('changes nothing but the import specifiers', () => {
    const withoutImports = (source: string) =>
      source
        .split('\n')
        .filter((line) => !line.includes("from '"))
        .join('\n');

    for (const root of [mongoFacade, platform]) {
      expect(withoutImports(render(root))).toEqual(withoutImports(render(internalImportRoot)));
    }
  });
});
