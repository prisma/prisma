import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { publicShells } from '../src/shells';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

function manifestName(dir: string): string {
  const manifest: unknown = JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));
  if (typeof manifest !== 'object' || manifest === null || !('name' in manifest)) {
    throw new Error(`${dir}/package.json has no name`);
  }
  const { name } = manifest;
  if (typeof name !== 'string') throw new Error(`${dir}/package.json name is not a string`);
  return name;
}

describe('publicShells', () => {
  it('declares the package name each mapped directory actually has', () => {
    const drifted = [...publicShells.values()]
      .flatMap((shell) => shell.packages)
      .filter((pkg) => manifestName(pkg.dir) !== pkg.name)
      .map((pkg) => `${pkg.dir}: declared ${pkg.name}, manifest ${manifestName(pkg.dir)}`);

    expect(drifted).toEqual([]);
  });

  it('maps each internal package into exactly one shell', () => {
    const owners = new Map<string, string[]>();
    for (const [shellName, shell] of publicShells) {
      for (const pkg of shell.packages) {
        owners.set(pkg.name, [...(owners.get(pkg.name) ?? []), shellName]);
      }
    }
    const duplicated = [...owners].filter(([, shells]) => shells.length > 1);

    expect(duplicated).toEqual([]);
  });

  it('re-exports only packages another shell publishes', () => {
    const published = new Set(
      [...publicShells.values()].flatMap((shell) => shell.packages.map((pkg) => pkg.name)),
    );
    const dangling = [...publicShells.values()]
      .flatMap((shell) => shell.reexports ?? [])
      .map((reexport) => reexport.package)
      .filter((name) => !published.has(name));

    expect(dangling).toEqual([]);
  });

  it('classifies every shell', () => {
    const kinds = [...publicShells].map(([name, shell]) => `${name}: ${shell.kind}`);

    expect(kinds).toMatchInlineSnapshot(`
      [
        "@prisma/orm-framework: platform",
        "@prisma/orm-toolchain: platform",
        "@prisma/orm-family-sql: platform",
        "@prisma/orm-family-mongo: platform",
        "@prisma/orm-target-postgres: platform",
        "@prisma/orm-target-sqlite: platform",
        "@prisma/orm-target-mongo: platform",
        "@prisma/orm-postgres: facade",
        "@prisma/orm-sqlite: facade",
        "@prisma/orm-mongo: facade",
        "@prisma/orm-extension-postgis: extension",
        "@prisma/orm-extension-pgvector: extension",
        "@prisma/orm-extension-paradedb: extension",
        "@prisma/orm-extension-supabase: extension",
        "@prisma/orm-extension-arktype-json: extension",
        "@prisma/orm-extension-middleware-cache: extension",
      ]
    `);
  });
});
