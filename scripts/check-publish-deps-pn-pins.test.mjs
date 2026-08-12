import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { findLeaks, findPnPinViolations, isExactPnVersion } from './check-publish-deps.mjs';

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
          '@internal/contract': '0.7.0',
          '@internal/postgres': '0.7.0',
          arktype: '^2.1.29',
        },
        peerDependencies: { '@internal/framework-components': '0.7.0' },
      }),
      [],
    );
  });

  it('flags a caret range in dependencies', () => {
    const v = findPnPinViolations({
      name: '@scope/pkg',
      dependencies: { '@internal/contract': '^0.7.0' },
    });
    assert.equal(v.length, 1);
    assert.deepEqual(v[0], {
      field: 'dependencies',
      name: '@internal/contract',
      spec: '^0.7.0',
    });
  });

  it('flags every common imprecise form', () => {
    for (const spec of ['^0.7.0', '~0.7.0', '>=0.7.0', '0.7.x', '*', '0.7.0 || 0.8.0']) {
      const v = findPnPinViolations({
        name: '@scope/pkg',
        dependencies: { '@internal/contract': spec },
      });
      assert.equal(v.length, 1, `expected ${spec} to be flagged`);
      assert.equal(v[0].spec, spec);
    }
  });

  it('flags violations in peerDependencies and optionalDependencies, not just dependencies', () => {
    const v = findPnPinViolations({
      name: '@scope/pkg',
      peerDependencies: { '@internal/a': '^0.7.0' },
      optionalDependencies: { '@internal/b': '~0.7.0' },
    });
    assert.equal(v.length, 2);
    const fields = v.map((x) => x.field).sort();
    assert.deepEqual(fields, ['optionalDependencies', 'peerDependencies']);
  });

  it('does not flag entries in devDependencies (those do not ship to consumers)', () => {
    assert.deepEqual(
      findPnPinViolations({
        name: '@scope/pkg',
        devDependencies: { '@internal/contract': '^0.7.0' },
      }),
      [],
    );
  });

  it('does not flag non-@internal/* deps', () => {
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
      dependencies: { '@internal/contract': '0.7.0' },
      peerDependencies: { '@internal/postgres': '^0.7.0' },
    });
    assert.equal(v.length, 1);
    assert.equal(v[0].field, 'peerDependencies');
  });

  it('does not double-report a workspace:/catalog: spec (delegated to the leak rule)', () => {
    const pkg = {
      name: '@scope/pkg',
      dependencies: {
        '@internal/contract': 'workspace:0.7.0',
        '@internal/postgres': 'catalog:',
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
        dependencies: { '@internal/contract': '0.7.0-dev.5' },
      }),
      [],
    );
  });
});
