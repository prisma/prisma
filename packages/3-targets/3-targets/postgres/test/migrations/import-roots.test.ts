import {
  createImportSpecifierResolver,
  type ImportRoot,
  ImportRootError,
  importedSpecifiers,
  internalImportRoot,
  transitiveImports,
} from '@prisma-next/publish-surface/import-roots';
import { col, lit, primaryKey } from '@prisma-next/sql-relational-core/contract-free';
import { describe, expect, it } from 'vitest';
import {
  AddColumnCall,
  CreateSchemaCall,
  CreateTableCall,
} from '../../src/core/migrations/op-factory-call';
import { renderCallsToTypeScript } from '../../src/core/migrations/render-typescript';

const postgresFacade: ImportRoot = { mode: 'facade', facade: '@prisma/orm-postgres' };
const platform: ImportRoot = { mode: 'platform' };

const FROM_HASH = 'a'.repeat(64);
const TO_HASH = 'b'.repeat(64);

function render(root: ImportRoot): string {
  return renderCallsToTypeScript(
    [
      new CreateSchemaCall('app'),
      new CreateTableCall(
        'app',
        'user',
        [col('id', 'text', { notNull: true }), col('kind', 'text', { default: lit('draft') })],
        [primaryKey(['id'])],
      ),
      new AddColumnCall('app', 'user', col('email', 'text')),
    ],
    {
      from: FROM_HASH,
      to: TO_HASH,
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
  it('names the workspace facade under the internal root', () => {
    expect(packageImports(render(internalImportRoot))).toEqual(['@prisma-next/postgres/migration']);
  });

  it('names the published facade under the facade root', () => {
    expect(packageImports(render(postgresFacade))).toEqual(['@prisma/orm-postgres/migration']);
  });

  it('leaves the relative snapshot imports alone', () => {
    const relative = importedSpecifiers(render(postgresFacade))
      .filter((specifier) => specifier.startsWith('.'))
      .sort();

    expect(relative).toEqual([
      `../../snapshots/${FROM_HASH}/contract`,
      `../../snapshots/${FROM_HASH}/contract.json`,
      `../../snapshots/${TO_HASH}/contract`,
      `../../snapshots/${TO_HASH}/contract.json`,
    ]);
  });

  it('imports nothing the application would not depend on directly', () => {
    for (const root of [internalImportRoot, postgresFacade]) {
      expect(transitiveImports(render(root), root)).toEqual([]);
    }
  });

  it('changes nothing but the import specifiers', () => {
    const withoutImports = (source: string) =>
      source
        .split('\n')
        .filter((line) => !line.includes("from '"))
        .join('\n');

    expect(withoutImports(render(postgresFacade))).toEqual(
      withoutImports(render(internalImportRoot)),
    );
  });

  // The scaffold's single `@prisma-next/postgres/migration` import merges
  // symbols from four packages: the target's `Migration` base, the CLI's
  // `MigrationCLI`, the SQL family's contract-free DDL builders, and the
  // framework's `placeholder`. A decomposed install has no facade to merge
  // them, and one specifier cannot be split by symbol, so this combination
  // has no answer yet — see TML-3126. Failing loudly beats emitting an
  // import that would not resolve in the user's project.
  it('refuses the platform root, which has no facade to name', () => {
    expect(() => render(platform)).toThrow(ImportRootError);
    expect(() => render(platform)).toThrow(/does not depend on directly/);
  });
});
