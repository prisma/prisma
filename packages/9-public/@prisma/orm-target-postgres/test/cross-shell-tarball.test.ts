import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  findInternalImportSpecifiers,
  findInternalNames,
  importSubpaths,
  installShells,
  packShell,
  runInScratch,
} from '@repo/tsdown/shell-testkit';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const chain = ['orm-target-postgres', 'orm-family-sql', 'orm-framework', 'orm-toolchain'];

describe('cross-shell tarball chain (target-postgres -> family-sql -> framework, toolchain)', () => {
  let scratch: string;

  beforeAll(() => {
    scratch = mkdtempSync(join(tmpdir(), 'orm-cross-shell-smoke-'));
    installShells(
      scratch,
      chain.map((shell) => packShell(join(publicRoot, shell), scratch)),
    );
  });

  afterAll(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it('resolves and imports every entrypoint of every shell in the chain', () => {
    const imports: string[] = [];
    for (const shell of chain) {
      const installedDir = join(scratch, 'node_modules', '@prisma', shell);
      for (const subpath of importSubpaths(installedDir)) {
        imports.push(`@prisma/${shell}${subpath.slice(1)}`);
      }
    }
    const script = [
      `const specifiers = ${JSON.stringify(imports)};`,
      'for (const specifier of specifiers) {',
      '  await import(specifier);',
      '}',
      `console.log('resolved ' + specifiers.length);`,
    ].join('\n');
    expect(runInScratch(scratch, script)).toContain(`resolved ${imports.length}`);
  });

  it('resolves the prepared-query bridge used by the Supabase extension', () => {
    const script = `
      const preparedQuery = await import('@prisma/orm-family-sql/runtime/internal/prepared-query');
      if (typeof preparedQuery.preparedStatementQuery !== 'symbol') {
        throw new Error('prepared-query bridge is not exported');
      }
      console.log('prepared-query bridge ok');
    `;
    expect(runInScratch(scratch, script)).toContain('prepared-query bridge ok');
  });

  it('keeps framework modules identical when reached through family-sql', () => {
    const script = `
      import { strict as assert } from 'node:assert';
      const direct = await import('@prisma/orm-framework/contract/resolve-domain-model');
      const viaFamily = await import('@prisma/orm-family-sql/family/runtime');
      assert.equal(direct.resolveDomainModel, viaFamily.resolveDomainModel);
      const authoring = await import('@prisma/orm-framework/contract-authoring');
      const contractTs = await import('@prisma/orm-family-sql/contract-ts/contract-builder');
      assert.equal(authoring.enumType, contractTs.enumType);
      console.log('cross-shell identity ok');
    `;
    expect(runInScratch(scratch, script)).toContain('cross-shell identity ok');
  });

  it('links a working prisma-next bin from the toolchain shell', () => {
    const output = execFileSync(join(scratch, 'node_modules', '.bin', 'prisma-next'), ['--help'], {
      encoding: 'utf8',
    });
    expect(output).toContain('prisma-next');
    expect(output).toContain('init');
  });

  it('ships no unrecorded internal package name in any shell dist', async () => {
    for (const shell of chain) {
      const installedDir = join(scratch, 'node_modules', '@prisma', shell);
      expect(await findInternalNames(installedDir)).toEqual([]);
    }
  });

  it('ships no @internal import specifier in any shell dist', async () => {
    for (const shell of chain) {
      const installedDir = join(scratch, 'node_modules', '@prisma', shell);
      expect(await findInternalImportSpecifiers(installedDir)).toEqual([]);
    }
  });
});
