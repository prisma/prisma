/**
 * What the in-repo consumers need from the published surface, and what the
 * facades do not carry yet.
 *
 * ADR 242 promises that an application installs one `@prisma/orm-<database>`
 * package and gets the stack. `examples/` and `apps/` are the check on that
 * promise: they are ordinary applications, and every workspace package they
 * name has to have a facade entrypoint before they can move to published
 * names. A consumer cannot move halfway — a shell bundles its own copy of
 * each internal package, so naming both roots at once means two copies of
 * everything they share (see
 * `packages/9-public/@prisma/orm-framework/test/module-identity.test.ts`).
 *
 * The list below is therefore the remaining work on the published surface,
 * expressed as code so it shrinks visibly and cannot silently grow. Each
 * entry is an internal package that some example imports and that no facade
 * republishes. Closing one is a `reexports` entry in `../src/shells`, or a
 * decision that the surface should not carry it — not a reason for the
 * example to keep the workspace name.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createImportSpecifierResolver, type ImportRoot } from '../src/import-roots';
import { publicShells, type ShellName } from '../src/shells';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const consumerRoots = ['examples', 'apps'];
const facades: ShellName[] = ['@prisma/orm-postgres', '@prisma/orm-sqlite', '@prisma/orm-mongo'];

const INCLUDED_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
const EXCLUDED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'dist-tsc',
  'dist-tsc-prod',
  'coverage',
  '.tmp-output',
  '.next',
  '.turbo',
  'build',
]);
const MODULE_SPECIFIER = /\b(?:from|import)\s*\(?\s*(['"])([^'"\n]+)\1/g;

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRECTORIES.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (INCLUDED_EXTENSIONS.has(extname(full))) yield full;
  }
}

function consumerSpecifiers(): ReadonlySet<string> {
  const specifiers = new Set<string>();
  for (const root of consumerRoots) {
    for (const file of walk(join(repoRoot, root))) {
      for (const [, , specifier] of readFileSync(file, 'utf8').matchAll(MODULE_SPECIFIER)) {
        if (specifier?.startsWith('@prisma-next/')) specifiers.add(specifier);
      }
    }
  }
  return specifiers;
}

function packageOf(specifier: string): string {
  const [scope, name] = specifier.split('/');
  return `${scope}/${name}`;
}

/** Whether any facade has a name for `specifier`. */
function anyFacadeCarries(specifier: string): boolean {
  return facades.some((facade) => {
    const root: ImportRoot = { mode: 'facade', facade };
    try {
      createImportSpecifierResolver(root)(specifier);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Internal packages an example imports that no facade republishes.
 *
 * `@prisma-next/test-utils` is the one entry that is not a gap in the
 * published surface: it is the repository's own test helper, has no published
 * counterpart by design, and is a devDependency of the example test files
 * that use it. It is listed so the check stays exhaustive, and it is the one
 * entry that closing the others will not remove.
 */
const notCarriedByAnyFacade: readonly string[] = [
  '@prisma-next/cli',
  '@prisma-next/driver-mongo',
  '@prisma-next/driver-postgres',
  '@prisma-next/family-mongo',
  '@prisma-next/family-sql',
  '@prisma-next/migration-tools',
  '@prisma-next/mongo-orm',
  '@prisma-next/mongo-query-ast',
  '@prisma-next/mongo-query-builder',
  '@prisma-next/mongo-runtime',
  '@prisma-next/mongo-value',
  '@prisma-next/sql-builder',
  '@prisma-next/sql-contract-psl',
  '@prisma-next/sql-contract-ts',
  '@prisma-next/sql-orm-client',
  '@prisma-next/sql-relational-core',
  '@prisma-next/sql-runtime',
  '@prisma-next/test-utils',
  '@prisma-next/utils',
  '@prisma-next/vite-plugin-contract-emit',
];

describe('the published surface against the applications that will consume it', () => {
  const specifiers = [...consumerSpecifiers()].sort();

  it('reads the consumers at all', () => {
    // A scan that stopped matching would report a clean surface, which is the
    // one result that would be worse than no check.
    expect(specifiers.length).toBeGreaterThan(50);
  });

  it('states exactly which internal packages no facade carries', () => {
    const uncarried = [
      ...new Set(specifiers.filter((s) => !anyFacadeCarries(s)).map(packageOf)),
    ].sort();

    expect(uncarried).toEqual([...notCarriedByAnyFacade].sort());
  });

  // The contract-shaped surfaces do resolve, which is why generated
  // `contract.d.ts` and `migration.ts` can name published packages before the
  // hand-written source of the same application does.
  it('carries every surface emitted code names', () => {
    const emitted = [
      '@prisma-next/contract/types',
      '@prisma-next/framework-components/control',
      '@prisma-next/sql-contract/types',
      '@prisma-next/mongo-contract',
      '@prisma-next/adapter-postgres/operation-types',
      '@prisma-next/adapter-mongo/codec-types',
      '@prisma-next/target-postgres/codec-types',
      '@prisma-next/postgres/migration',
      '@prisma-next/sqlite/migration',
      '@prisma-next/target-mongo/migration',
    ];

    expect(emitted.filter((specifier) => !anyFacadeCarries(specifier))).toEqual([]);
  });

  // Extension packs are installed alongside the facade, so an example may
  // name them directly under the facade root.
  it('lets an application name an extension pack it installed', () => {
    const extensions = [...publicShells]
      .filter(([, shell]) => shell.kind === 'extension')
      .flatMap(([, shell]) => shell.packages.map((pkg) => pkg.name));

    expect(extensions.filter((name) => !anyFacadeCarries(name))).toEqual([]);
  });
});
