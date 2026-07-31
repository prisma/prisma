import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { findPublishabilityViolations, main } from './lint-publishable.mjs';

let clean;
let dirty;

function pkg(base, relativeDir, manifest) {
  const dir = join(base, relativeDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify(manifest));
}

before(() => {
  clean = mkdtempSync(join(tmpdir(), 'lint-publishable-clean-'));
  pkg(clean, '.', { name: 'workspace-root', private: true });
  pkg(clean, 'packages/9-public/@prisma/orm-postgres', { name: '@prisma/orm-postgres' });
  pkg(clean, 'packages/9-public/prisma-next', { name: 'prisma-next' });
  pkg(clean, 'packages/2-sql/5-runtime', { name: '@prisma-next/sql-runtime', private: true });
  pkg(clean, 'examples/demo', { name: 'demo', private: true });

  dirty = mkdtempSync(join(tmpdir(), 'lint-publishable-dirty-'));
  pkg(dirty, '.', { name: 'workspace-root', private: true });
  pkg(dirty, 'packages/9-public/@prisma/orm-framework', { name: '@prisma/orm-framework' });
  pkg(dirty, 'packages/9-public/@prisma/orm-toolchain', {
    name: '@prisma/orm-toolchain',
    private: true,
  });
  pkg(dirty, 'packages/2-sql/5-runtime', { name: '@prisma-next/sql-runtime' });
  pkg(dirty, 'test/utils', { name: '@prisma-next/test-utils' });
});

after(() => {
  for (const base of [clean, dirty]) rmSync(base, { recursive: true, force: true });
});

describe('findPublishabilityViolations', () => {
  test('reports a package outside packages/9-public that would publish', () => {
    const violations = findPublishabilityViolations(dirty).filter(
      (v) => v.kind === 'publishable-outside',
    );
    assert.deepEqual(violations.map((v) => v.name).sort(), [
      '@prisma-next/sql-runtime',
      '@prisma-next/test-utils',
    ]);
  });

  test('reports a package inside packages/9-public that is private', () => {
    const violations = findPublishabilityViolations(dirty).filter(
      (v) => v.kind === 'private-inside',
    );
    assert.deepEqual(
      violations.map((v) => v.name),
      ['@prisma/orm-toolchain'],
    );
  });

  test('accepts a tree where publishability matches the directory', () => {
    assert.deepEqual(findPublishabilityViolations(clean), []);
  });

  // The workspace root manifest is the workspace, not a package, and its
  // directory is neither inside nor outside in the sense the rule means.
  test('ignores the workspace root manifest', () => {
    const names = findPublishabilityViolations(dirty).map((v) => v.name);
    assert.ok(!names.includes('workspace-root'));
  });
});

describe('main(baseDir)', () => {
  test('fails a tree with a publishable package outside packages/9-public', () => {
    const base = mkdtempSync(join(tmpdir(), 'lint-publishable-outside-'));
    pkg(base, 'packages/9-public/@prisma/orm-framework', { name: '@prisma/orm-framework' });
    pkg(base, 'packages/1-framework/0-foundation/contract', { name: '@prisma-next/contract' });
    assert.equal(main(base), 1);
    rmSync(base, { recursive: true, force: true });
  });

  test('fails a tree with a private package inside packages/9-public', () => {
    const base = mkdtempSync(join(tmpdir(), 'lint-publishable-inside-'));
    pkg(base, 'packages/9-public/@prisma/orm-framework', {
      name: '@prisma/orm-framework',
      private: true,
    });
    assert.equal(main(base), 1);
    rmSync(base, { recursive: true, force: true });
  });

  test('passes a tree where publishability matches the directory', () => {
    assert.equal(main(clean), 0);
  });
});
