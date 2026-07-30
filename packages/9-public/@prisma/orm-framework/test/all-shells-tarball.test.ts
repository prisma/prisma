import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findInternalSpecifiers,
  importSubpaths,
  installShells,
  packShell,
  runInScratch,
} from '@prisma-next/tsdown/shell-testkit';
import { publicShells } from '@prisma-next/tsdown/shells';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const allShells = [...publicShells.keys()];
const uncoveredElsewhere = [
  '@prisma/orm-family-mongo',
  '@prisma/orm-target-mongo',
  '@prisma/orm-target-sqlite',
  '@prisma/orm-sqlite',
  '@prisma/orm-mongo',
  '@prisma/orm-extension-postgis',
  '@prisma/orm-extension-paradedb',
  '@prisma/orm-extension-supabase',
  '@prisma/orm-extension-arktype-json',
  '@prisma/orm-extension-middleware-cache',
];
const adrExampleNames = [
  '@prisma/orm-framework/contract',
  '@prisma/orm-framework/components',
  '@prisma/orm-framework/psl-parser',
  '@prisma/orm-family-sql/contract',
  '@prisma/orm-family-sql/runtime',
  '@prisma/orm-family-sql/orm-client',
  '@prisma/orm-target-postgres/target',
  '@prisma/orm-target-postgres/adapter',
  '@prisma/orm-target-postgres/driver',
  '@prisma/orm-toolchain/cli',
  '@prisma/orm-postgres/runtime',
  '@prisma/orm-postgres/contract',
  '@prisma/orm-postgres/components',
  '@prisma/orm-sqlite/runtime',
  '@prisma/orm-mongo/runtime',
];

describe('all publish shells packed and installed together', () => {
  let scratch: string;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'orm-all-shells-smoke-'));
    installShells(
      scratch,
      allShells.map((name) => {
        const shell = publicShells.get(name);
        if (shell === undefined) throw new Error(`unknown shell ${name}`);
        return packShell(join(repoRoot, shell.dir), scratch);
      }),
    );
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('installs every shell', () => {
    for (const name of allShells) {
      expect(existsSync(join(scratch, 'node_modules', name, 'package.json'))).toBe(true);
    }
  });

  it('resolves and imports every entrypoint of the shells not covered by the chain test', () => {
    const imports: string[] = [];
    for (const name of uncoveredElsewhere) {
      const installedDir = join(scratch, 'node_modules', name);
      for (const subpath of importSubpaths(installedDir)) {
        imports.push(`${name}${subpath.slice(1)}`);
      }
    }
    const script = [
      `const specifiers = ${JSON.stringify(imports)};`,
      'for (const specifier of specifiers) {',
      '  await import(specifier);',
      '}',
      "console.log('resolved ' + specifiers.length);",
    ].join('\n');
    expect(runInScratch(scratch, script)).toContain(`resolved ${imports.length}`);
  });

  it('resolves the aggregate entrypoint names promised by ADR 242', () => {
    const script = [
      `const specifiers = ${JSON.stringify(adrExampleNames)};`,
      'for (const specifier of specifiers) {',
      '  const mod = await import(specifier);',
      '  if (Object.keys(mod).length === 0) throw new Error(specifier + " is empty");',
      '}',
      "console.log('adr names ok');",
    ].join('\n');
    expect(runInScratch(scratch, script)).toContain('adr names ok');
  });

  it('ships no @prisma-next import specifier in any shell dist', async () => {
    for (const name of allShells) {
      const installedDir = join(scratch, 'node_modules', name);
      expect(await findInternalSpecifiers(installedDir)).toEqual([]);
    }
  });
});
