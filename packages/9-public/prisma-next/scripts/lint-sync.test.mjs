import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findShimDrift } from './lint-sync.mjs';

const TOOLCHAIN = '@prisma/orm-toolchain';

function fixtures() {
  return {
    shimPkg: {
      name: 'prisma-next',
      version: '0.16.0',
      bin: { 'prisma-next': './bin/prisma-next.mjs' },
      dependencies: { [TOOLCHAIN]: 'workspace:0.16.0' },
      files: ['bin'],
    },
    toolchainPkg: {
      name: TOOLCHAIN,
      version: '0.16.0',
      bin: { 'prisma-next': './dist/bin__prisma-next.mjs' },
      exports: { './bin/prisma-next': './dist/bin__prisma-next.mjs' },
    },
    launcherSource: `#!/usr/bin/env node\nimport '${TOOLCHAIN}/bin/prisma-next';\n`,
  };
}

test('clean shim has no drift', () => {
  assert.deepEqual(findShimDrift(fixtures()), []);
});

test('version out of lockstep with the toolchain', () => {
  const f = fixtures();
  f.shimPkg.version = '0.15.0';
  assert.ok(findShimDrift(f).some((d) => d.includes('version')));
});

test('dependency pin not matching the shim version', () => {
  const f = fixtures();
  f.shimPkg.dependencies = { [TOOLCHAIN]: 'workspace:0.15.0' };
  assert.ok(findShimDrift(f).some((d) => d.includes('workspace:0.16.0')));
});

test('extra runtime dependency', () => {
  const f = fixtures();
  f.shimPkg.dependencies.pathe = '^2.0.3';
  assert.ok(findShimDrift(f).some((d) => d.includes('pathe')));
});

test('devDependencies are not allowed', () => {
  const f = fixtures();
  f.shimPkg.devDependencies = { '@internal/cli': 'workspace:0.16.0' };
  assert.ok(findShimDrift(f).some((d) => d.includes('devDependencies')));
});

test('bin must point at the committed launcher', () => {
  const f = fixtures();
  f.shimPkg.bin = { 'prisma-next': './dist/cli.js' };
  assert.ok(findShimDrift(f).some((d) => d.includes('./bin/prisma-next.mjs')));
});

test('launcher must import the toolchain bin entrypoint', () => {
  const f = fixtures();
  f.launcherSource = '#!/usr/bin/env node\nconsole.log("hi");\n';
  assert.ok(findShimDrift(f).some((d) => d.includes(`${TOOLCHAIN}/bin/prisma-next`)));
});

test('toolchain must publish the bin entrypoint the launcher imports', () => {
  const f = fixtures();
  delete f.toolchainPkg.exports['./bin/prisma-next'];
  assert.ok(findShimDrift(f).some((d) => d.includes('./bin/prisma-next')));
});

test('import surface fields are forbidden', () => {
  const f = fixtures();
  f.shimPkg.exports = { '.': './bin/prisma-next.mjs' };
  f.shimPkg.main = './bin/prisma-next.mjs';
  f.shimPkg.types = './bin/prisma-next.d.mts';
  const drift = findShimDrift(f);
  for (const field of ['exports', 'main', 'types']) {
    assert.ok(drift.some((d) => d.includes(`"${field}"`)));
  }
});

test('files must ship exactly the bin directory', () => {
  const f = fixtures();
  f.shimPkg.files = ['bin', 'dist'];
  assert.ok(findShimDrift(f).some((d) => d.includes('files')));
});
