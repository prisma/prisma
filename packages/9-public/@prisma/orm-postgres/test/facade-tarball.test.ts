import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicShells, type ShellName } from '@prisma-next/publish-surface/shells';
import {
  bundledSources,
  findInternalImportSpecifiers,
  findInternalNames,
  importSubpaths,
  installShells,
  type PackedShell,
  packShell,
  runInScratch,
} from '@prisma-next/tsdown/shell-testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
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

describe('an application that installs only the Postgres facade', () => {
  let scratch: string;
  let installedDir: string;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'orm-postgres-facade-'));
    installShells(scratch, pack(scratch, [facade, ...platform]), { direct: [facade] });
    installedDir = join(scratch, 'node_modules', '@prisma', 'orm-postgres');
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('resolves and imports every facade entrypoint', () => {
    const subpaths = importSubpaths(installedDir);
    expect(subpaths.length).toBeGreaterThan(60);
    const script = [
      `const subpaths = ${JSON.stringify(subpaths)};`,
      'for (const subpath of subpaths) {',
      `  await import('${facade}' + subpath.slice(1));`,
      '}',
      `console.log('resolved ' + subpaths.length);`,
    ].join('\n');
    expect(runInScratch(scratch, script)).toContain(`resolved ${subpaths.length}`);
  });

  it('pulls every platform shell in transitively', () => {
    const script = [
      "import { createRequire } from 'node:module';",
      `const require = createRequire(import.meta.resolve('${facade}/package.json'));`,
      `const shells = ${JSON.stringify(platform)};`,
      'for (const shell of shells) require.resolve(shell + "/package.json");',
      `console.log('platform ok');`,
    ].join('\n');
    expect(runInScratch(scratch, script)).toContain('platform ok');
  });

  it('puts a working prisma-next command on PATH', () => {
    const help = execFileSync('pnpm', ['exec', 'prisma-next', '--help'], {
      cwd: scratch,
      encoding: 'utf8',
    });
    expect(help).toContain('prisma-next');
  });

  it('bundles only its own wiring code', () => {
    const sources = bundledSources(installedDir);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source).toMatch(/^3-extensions\/postgres\//);
    }
  });

  it('ships no unrecorded internal package name in dist', async () => {
    expect(await findInternalNames(installedDir)).toEqual([]);
  });

  it('ships no @prisma-next import specifier in dist', async () => {
    expect(await findInternalImportSpecifiers(installedDir)).toEqual([]);
  });
});

describe('the Postgres facade alongside its platform shells', () => {
  let scratch: string;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'orm-postgres-identity-'));
    installShells(scratch, pack(scratch, [facade, ...platform]));
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('shares one module instance across every facade to shell boundary', () => {
    const script = `
      import { strict as assert } from 'node:assert';
      const facadeContract = await import('${facade}/contract/is-plain-record');
      const frameworkContract = await import('@prisma/orm-framework/contract/is-plain-record');
      assert.equal(facadeContract.isPlainRecord, frameworkContract.isPlainRecord);

      const facadeComponents = await import('${facade}/components/execution');
      const frameworkComponents = await import('@prisma/orm-framework/components/execution');
      assert.equal(facadeComponents.instantiateExecutionStack, frameworkComponents.instantiateExecutionStack);

      const facadeFamily = await import('${facade}/family-contract/entity-kinds');
      const familyShell = await import('@prisma/orm-family-sql/contract/entity-kinds');
      assert.equal(facadeFamily.tableEntityKind, familyShell.tableEntityKind);

      const facadeAdapter = await import('${facade}/adapter/runtime');
      const targetAdapter = await import('@prisma/orm-target-postgres/adapter/runtime');
      assert.equal(facadeAdapter.default, targetAdapter.default);

      const facadeTarget = await import('${facade}/target');
      const targetPack = await import('@prisma/orm-target-postgres/target/pack');
      assert.equal(facadeTarget.default, targetPack.default);
      console.log('identity ok');
    `;
    expect(runInScratch(scratch, script)).toContain('identity ok');
  });

  it('reaches the ORM client only through the SQL family shell', () => {
    const facadeSources = bundledSources(join(scratch, 'node_modules', '@prisma', 'orm-postgres'));
    expect(facadeSources.filter((s) => s.includes('sql-orm-client'))).toEqual([]);
    const script = `
      import { strict as assert } from 'node:assert';
      const { orm } = await import('@prisma/orm-family-sql/orm-client');
      assert.equal(typeof orm, 'function');
      console.log('orm-client ok');
    `;
    expect(runInScratch(scratch, script)).toContain('orm-client ok');
  });
});
