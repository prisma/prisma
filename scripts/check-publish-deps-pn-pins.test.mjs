import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  findLeaks,
  findPnPinViolations,
  findPrivateNames,
  isExactPnVersion,
} from './check-publish-deps.mjs';

describe('isExactPnVersion', () => {
  it('accepts a clean release version', () => {
    assert.equal(isExactPnVersion('0.7.0'), true);
    assert.equal(isExactPnVersion('12.34.567'), true);
  });
  it('accepts a pre-release suffix', () => {
    assert.equal(isExactPnVersion('0.7.0-dev.5'), true);
    assert.equal(isExactPnVersion('1.0.0-rc.2'), true);
    assert.equal(isExactPnVersion('0.7.0-alpha.0'), true);
  });
  it('rejects every operator and wildcard form', () => {
    assert.equal(isExactPnVersion('^0.7.0'), false);
    assert.equal(isExactPnVersion('~0.7.0'), false);
    assert.equal(isExactPnVersion('>=0.7.0'), false);
    assert.equal(isExactPnVersion('>0.7.0'), false);
    assert.equal(isExactPnVersion('0.7.x'), false);
    assert.equal(isExactPnVersion('0.x'), false);
    assert.equal(isExactPnVersion('*'), false);
    assert.equal(isExactPnVersion('0.7.0 || 0.8.0'), false);
    assert.equal(isExactPnVersion('>=0.7.0 <0.8.0'), false);
  });
  it("rejects workspace:/catalog: protocols (those are the leak rule's job)", () => {
    assert.equal(isExactPnVersion('workspace:*'), false);
    assert.equal(isExactPnVersion('workspace:0.7.0'), false);
    assert.equal(isExactPnVersion('catalog:'), false);
    assert.equal(isExactPnVersion('catalog:react18'), false);
  });
  it('rejects non-strings', () => {
    assert.equal(isExactPnVersion(undefined), false);
    assert.equal(isExactPnVersion(null), false);
    assert.equal(isExactPnVersion(0), false);
    assert.equal(isExactPnVersion({}), false);
  });
});

describe('findPnPinViolations', () => {
  it('returns [] for a clean exact-pinned manifest', () => {
    assert.deepEqual(
      findPnPinViolations({
        name: '@scope/pkg',
        version: '0.7.0',
        dependencies: {
          '@prisma/orm-framework': '0.7.0',
          '@prisma/orm-postgres': '0.7.0',
          arktype: '^2.1.29',
        },
        peerDependencies: { '@prisma/orm-family-sql': '0.7.0' },
      }),
      [],
    );
  });

  it('flags a caret range in dependencies', () => {
    const v = findPnPinViolations({
      name: '@scope/pkg',
      dependencies: { '@prisma/orm-framework': '^0.7.0' },
    });
    assert.equal(v.length, 1);
    assert.deepEqual(v[0], {
      field: 'dependencies',
      name: '@prisma/orm-framework',
      spec: '^0.7.0',
    });
  });

  it('flags every common imprecise form', () => {
    for (const spec of ['^0.7.0', '~0.7.0', '>=0.7.0', '0.7.x', '*', '0.7.0 || 0.8.0']) {
      const v = findPnPinViolations({
        name: '@scope/pkg',
        dependencies: { '@prisma/orm-framework': spec },
      });
      assert.equal(v.length, 1, `expected ${spec} to be flagged`);
      assert.equal(v[0].spec, spec);
    }
  });

  it('flags violations in peerDependencies and optionalDependencies, not just dependencies', () => {
    const v = findPnPinViolations({
      name: '@scope/pkg',
      peerDependencies: { '@prisma/orm-target-postgres': '^0.7.0' },
      optionalDependencies: { '@prisma/orm-target-sqlite': '~0.7.0' },
    });
    assert.equal(v.length, 2);
    const fields = v.map((x) => x.field).sort();
    assert.deepEqual(fields, ['optionalDependencies', 'peerDependencies']);
  });

  it('does not flag entries in devDependencies (those do not ship to consumers)', () => {
    assert.deepEqual(
      findPnPinViolations({
        name: '@scope/pkg',
        devDependencies: { '@prisma/orm-framework': '^0.7.0' },
      }),
      [],
    );
  });

  it('does not flag non-@prisma/orm-* deps', () => {
    assert.deepEqual(
      findPnPinViolations({
        name: '@scope/pkg',
        dependencies: { arktype: '^2.1.29', '@example/other': '*' },
      }),
      [],
    );
  });

  it('cross-field: a range in peerDependencies still fails even if dependencies is clean', () => {
    const v = findPnPinViolations({
      name: '@scope/pkg',
      dependencies: { '@prisma/orm-framework': '0.7.0' },
      peerDependencies: { '@prisma/orm-postgres': '^0.7.0' },
    });
    assert.equal(v.length, 1);
    assert.equal(v[0].field, 'peerDependencies');
  });

  it('does not double-report a workspace:/catalog: spec (delegated to the leak rule)', () => {
    const pkg = {
      name: '@scope/pkg',
      dependencies: {
        '@prisma/orm-framework': 'workspace:0.7.0',
        '@prisma/orm-postgres': 'catalog:',
      },
    };
    assert.deepEqual(findPnPinViolations(pkg), []);
    // …but the leak rule still catches them:
    assert.equal(findLeaks(pkg).length, 2);
  });

  it('accepts a pre-release exact version (e.g. 0.7.0-dev.5)', () => {
    assert.deepEqual(
      findPnPinViolations({
        name: '@scope/pkg',
        dependencies: { '@prisma/orm-framework': '0.7.0-dev.5' },
      }),
      [],
    );
  });
});

describe('findPrivateNames', () => {
  it('returns [] for a manifest naming only published packages', () => {
    assert.deepEqual(
      findPrivateNames({
        name: '@prisma/orm-postgres',
        dependencies: { '@prisma/orm-framework': '0.16.0', arktype: '^2.2.2' },
        devDependencies: { tsdown: '0.22.8' },
      }),
      [],
    );
  });

  // `pnpm pack` copies devDependencies into the tarball, so this is the
  // field the shells' build-time links would otherwise ship through.
  it('flags a private name in devDependencies', () => {
    assert.deepEqual(
      findPrivateNames({
        name: '@prisma/orm-framework',
        devDependencies: { '@prisma-next/contract': '0.16.0' },
      }),
      [{ field: 'devDependencies', name: '@prisma-next/contract', spec: '0.16.0' }],
    );
  });

  it('flags private names in every dependency field', () => {
    const found = findPrivateNames({
      name: 'prisma-next',
      dependencies: { '@prisma-next/cli': '0.16.0' },
      devDependencies: { '@prisma-next/tsdown': '0.16.0' },
      peerDependencies: { '@prisma-next/utils': '0.16.0' },
      optionalDependencies: { '@prisma-next/emitter': '0.16.0' },
    });
    assert.deepEqual(found.map((f) => f.field).sort(), [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]);
  });

  // An exact pin is not the point: the package does not exist under this
  // name at any version.
  it('flags a private name however precisely it is pinned', () => {
    assert.equal(
      findPrivateNames({ dependencies: { '@prisma-next/contract': '0.16.0' } }).length,
      1,
    );
    assert.equal(
      findPrivateNames({ dependencies: { '@prisma-next/contract': 'workspace:0.16.0' } }).length,
      1,
    );
  });
});
