import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import { main, stripPrivateDeps } from './pack-manifest.mjs';

const scratch = [];

function project(manifest) {
  const dir = mkdtempSync(join(tmpdir(), 'pack-manifest-'));
  scratch.push(dir);
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return dir;
}

function manifestOf(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
}

after(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

describe('stripPrivateDeps', () => {
  test('drops private names from every dependency field', () => {
    assert.deepEqual(
      stripPrivateDeps({
        name: '@prisma/orm-framework',
        dependencies: { '@prisma-next/utils': '0.16.0', arktype: '^2.2.2' },
        devDependencies: { '@prisma-next/tsdown': '0.16.0', tsdown: '0.22.8' },
        peerDependencies: { '@prisma-next/contract': '0.16.0', typescript: '>=5.9' },
      }),
      {
        name: '@prisma/orm-framework',
        dependencies: { arktype: '^2.2.2' },
        devDependencies: { tsdown: '0.22.8' },
        peerDependencies: { typescript: '>=5.9' },
      },
    );
  });

  // An empty `devDependencies: {}` in a published manifest says nothing;
  // removing the field says the same thing more plainly.
  test('removes a dependency field the strip left empty', () => {
    const out = stripPrivateDeps({
      name: '@prisma/orm-sqlite',
      devDependencies: { '@prisma-next/sqlite': '0.16.0' },
    });
    assert.equal('devDependencies' in out, false);
  });

  test('leaves a manifest with no private names alone', () => {
    const manifest = { name: 'prisma-next', dependencies: { '@prisma/orm-toolchain': '0.16.0' } };
    assert.deepEqual(stripPrivateDeps(manifest), manifest);
  });
});

describe('main', () => {
  test('--strip rewrites the manifest and --restore puts the original back', () => {
    const dir = project({
      name: '@prisma/orm-framework',
      devDependencies: { '@prisma-next/contract': 'workspace:0.16.0', tsdown: 'catalog:' },
    });
    const before = readFileSync(join(dir, 'package.json'), 'utf8');

    assert.equal(main(['--strip'], dir), 0);
    assert.deepEqual(manifestOf(dir).devDependencies, { tsdown: 'catalog:' });

    assert.equal(main(['--restore'], dir), 0);
    assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), before);
    assert.equal(existsSync(join(dir, 'package.json.pack-backup')), false);
  });

  // A pack killed between the two hooks leaves the manifest stripped and the
  // backup on disk. Packing again has to end up where it would have anyway,
  // rather than backing up the already-stripped manifest and losing the
  // dependencies permanently.
  test('--strip after an interrupted run restores first, so nothing is lost', () => {
    const dir = project({
      name: '@prisma/orm-framework',
      devDependencies: { '@prisma-next/contract': 'workspace:0.16.0' },
    });
    const before = readFileSync(join(dir, 'package.json'), 'utf8');

    main(['--strip'], dir); // interrupted here: no --restore
    main(['--strip'], dir);
    main(['--restore'], dir);

    assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), before);
  });

  test('--restore without a backup does nothing', () => {
    const dir = project({ name: 'prisma-next' });
    const before = readFileSync(join(dir, 'package.json'), 'utf8');
    assert.equal(main(['--restore'], dir), 0);
    assert.equal(readFileSync(join(dir, 'package.json'), 'utf8'), before);
  });

  test('rejects an unknown mode rather than guessing', () => {
    assert.equal(main([], project({ name: 'x' })), 2);
  });
});
