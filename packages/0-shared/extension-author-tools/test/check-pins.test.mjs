import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execPath } from 'node:process';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BIN_PATH = join(HERE, '..', 'bin', 'prisma-8-check-pins.mjs');

let scratchDir;

beforeEach(() => {
  scratchDir = mkdtempSync(join(tmpdir(), 'pn-check-pins-'));
});

afterEach(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

function writePackageJson(pkg) {
  writeFileSync(join(scratchDir, 'package.json'), JSON.stringify(pkg, null, 2));
}

function runCheck() {
  return spawnSync(execPath, [BIN_PATH], {
    cwd: scratchDir,
    encoding: 'utf8',
  });
}

describe('prisma-8-check-pins — pass cases', () => {
  it('exits 0 silently when every @internal/* dep is a single exact version', () => {
    writePackageJson({
      name: 'fixture-exact-pin',
      dependencies: {
        '@internal/contract': '0.7.0',
        '@internal/sql-contract': '0.7.0',
      },
    });
    const result = runCheck();
    assert.equal(
      result.status,
      0,
      `expected exit 0, got ${result.status}; stderr=${result.stderr}`,
    );
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  });

  it('accepts pre-release suffixes (e.g. 0.7.0-dev.123)', () => {
    writePackageJson({
      name: 'fixture-prerelease',
      dependencies: {
        '@internal/contract': '0.7.0-dev.123',
        '@internal/sql-contract': '0.7.0-dev.123',
      },
    });
    const result = runCheck();
    assert.equal(result.status, 0, `stderr=${result.stderr}`);
  });

  it('passes vacuously when no @internal/* entries are declared', () => {
    writePackageJson({
      name: 'fixture-no-pn-deps',
      dependencies: { arktype: '^2.1.0', pathe: '^2.0.0' },
    });
    const result = runCheck();
    assert.equal(result.status, 0, `stderr=${result.stderr}`);
  });

  it('ignores non-@internal/* entries regardless of their spec shape', () => {
    writePackageJson({
      name: 'fixture-mixed',
      dependencies: {
        '@internal/contract': '0.7.0',
        arktype: '^2.1.0',
        pathe: '*',
        typescript: 'workspace:*',
      },
    });
    const result = runCheck();
    assert.equal(result.status, 0, `stderr=${result.stderr}`);
  });

  it('checks all three dependency fields together', () => {
    writePackageJson({
      name: 'fixture-three-fields',
      dependencies: { '@internal/contract': '0.7.0' },
      peerDependencies: { '@internal/sql-contract': '0.7.0' },
      optionalDependencies: { '@internal/mongo-contract': '0.7.0' },
    });
    const result = runCheck();
    assert.equal(result.status, 0, `stderr=${result.stderr}`);
  });
});

describe('prisma-8-check-pins — exact-version rule violations', () => {
  for (const spec of ['^0.7.0', '~0.7.0', '>=0.7.0', '0.7.x', '*', 'x']) {
    it(`rejects non-exact spec ${JSON.stringify(spec)}`, () => {
      writePackageJson({
        name: 'fixture-range',
        dependencies: { '@internal/contract': spec },
      });
      const result = runCheck();
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /@internal\/contract/);
      assert.match(result.stderr, new RegExp(spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
  }

  for (const spec of ['workspace:*', 'workspace:^', 'workspace:~', 'workspace:0.7.0']) {
    it(`rejects workspace spec ${JSON.stringify(spec)}`, () => {
      writePackageJson({
        name: 'fixture-workspace',
        dependencies: { '@internal/contract': spec },
      });
      const result = runCheck();
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /@internal\/contract/);
      assert.match(result.stderr, /workspace/);
    });
  }
});

describe('prisma-8-check-pins — single-version rule violations', () => {
  it('rejects two @internal/* deps pinned to different exact versions', () => {
    writePackageJson({
      name: 'fixture-mismatched',
      dependencies: {
        '@internal/contract': '0.7.0',
        '@internal/sql-contract': '0.7.1',
      },
    });
    const result = runCheck();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /@internal\/sql-contract/);
    assert.match(result.stderr, /0\.7\.1/);
  });

  it('rejects a range in peerDependencies even when dependencies is exact', () => {
    writePackageJson({
      name: 'fixture-multi-field-violation',
      dependencies: { '@internal/contract': '0.7.0' },
      peerDependencies: { '@internal/sql-contract': '^0.7.0' },
    });
    const result = runCheck();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /peerDependencies/);
    assert.match(result.stderr, /@internal\/sql-contract/);
  });
});

describe('prisma-8-check-pins — error output shape', () => {
  it('names the dep field, package, observed spec, and rule for each violation', () => {
    writePackageJson({
      name: 'fixture-error-shape',
      dependencies: { '@internal/contract': '^0.7.0' },
      peerDependencies: { '@internal/sql-contract': 'workspace:*' },
    });
    const result = runCheck();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /dependencies\.@internal\/contract/);
    assert.match(result.stderr, /peerDependencies\.@internal\/sql-contract/);
    assert.match(result.stderr, /\^0\.7\.0/);
    assert.match(result.stderr, /workspace:\*/);
  });
});
