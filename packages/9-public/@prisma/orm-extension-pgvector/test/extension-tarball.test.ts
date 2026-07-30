import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bundledSources,
  findInternalSpecifiers,
  importSubpaths,
  installShells,
  type PackedShell,
  packShell,
  runInScratch,
} from '@prisma-next/tsdown/shell-testkit';
import { publicShells, type ShellName } from '@prisma-next/tsdown/shells';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const extension = '@prisma/orm-extension-pgvector';
const facade = '@prisma/orm-postgres';
const platform: ShellName[] = [
  '@prisma/orm-framework',
  '@prisma/orm-toolchain',
  '@prisma/orm-family-sql',
  '@prisma/orm-target-postgres',
];

function pack(scratch: string, names: readonly ShellName[]): PackedShell[] {
  return names.map((name) => {
    const shell = publicShells.get(name);
    if (shell === undefined) throw new Error(`unknown shell ${name}`);
    return packShell(join(repoRoot, shell.dir), scratch);
  });
}

describe('an extension pack installed next to the facade it extends', () => {
  let scratch: string;
  let installedDir: string;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'orm-extension-pgvector-'));
    installShells(scratch, pack(scratch, [extension, facade, ...platform]), {
      direct: [extension, facade],
    });
    installedDir = join(scratch, 'node_modules', '@prisma', 'orm-extension-pgvector');
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('resolves and imports every extension entrypoint', () => {
    const subpaths = importSubpaths(installedDir);
    expect(subpaths).toEqual([
      './codec-types',
      './column-types',
      './control',
      './operation-types',
      './pack',
      './runtime',
    ]);
    const script = [
      `const subpaths = ${JSON.stringify(subpaths)};`,
      'for (const subpath of subpaths) {',
      `  await import('${extension}' + subpath.slice(1));`,
      '}',
      `console.log('resolved ' + subpaths.length);`,
    ].join('\n');
    expect(runInScratch(scratch, script)).toContain(`resolved ${subpaths.length}`);
  });

  it('resolves its target-shell requirement to the copy the facade uses', () => {
    const script = `
      import { strict as assert } from 'node:assert';
      import { createRequire } from 'node:module';
      const fromExtension = createRequire(import.meta.resolve('${extension}/package.json'));
      const fromFacade = createRequire(import.meta.resolve('${facade}/package.json'));
      const target = '@prisma/orm-target-postgres/package.json';
      assert.equal(fromExtension.resolve(target), fromFacade.resolve(target));
      const viaExtension = await import(fromExtension.resolve('@prisma/orm-target-postgres/adapter/runtime'));
      const viaFacade = await import('${facade}/adapter/runtime');
      assert.equal(viaExtension.default, viaFacade.default);
      console.log('peer ok');
    `;
    expect(runInScratch(scratch, script)).toContain('peer ok');
  });

  it('bundles only its own extension code', () => {
    for (const source of bundledSources(installedDir)) {
      expect(source).toMatch(/^3-extensions\/pgvector\//);
    }
  });

  it('ships no @prisma-next import specifier in dist', async () => {
    expect(await findInternalSpecifiers(installedDir)).toEqual([]);
  });
});
