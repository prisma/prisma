import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyPackage,
  hasCorrectTypescriptPeer,
  MIN_TYPESCRIPT_PEER,
  runCheck,
} from './validate-typescript-peer.mjs';

const CONFORMING_PKG = {
  name: '@internal/example',
  version: '1.0.0',
  license: 'Apache-2.0',
  peerDependencies: { typescript: MIN_TYPESCRIPT_PEER },
  peerDependenciesMeta: { typescript: { optional: true } },
};

describe('hasCorrectTypescriptPeer', () => {
  it('returns true for a conforming peer declaration', () => {
    strictEqual(hasCorrectTypescriptPeer(CONFORMING_PKG), true);
  });

  it('returns false when typescript is missing from peerDependencies', () => {
    strictEqual(hasCorrectTypescriptPeer({ peerDependencies: {} }), false);
    strictEqual(hasCorrectTypescriptPeer({}), false);
  });

  it('returns false when the range does not match MIN_TYPESCRIPT_PEER', () => {
    strictEqual(
      hasCorrectTypescriptPeer({
        peerDependencies: { typescript: '>=5.0' },
        peerDependenciesMeta: { typescript: { optional: true } },
      }),
      false,
    );
  });

  it('returns false when optional is not set to true', () => {
    strictEqual(
      hasCorrectTypescriptPeer({
        peerDependencies: { typescript: MIN_TYPESCRIPT_PEER },
        peerDependenciesMeta: { typescript: { optional: false } },
      }),
      false,
    );
    strictEqual(
      hasCorrectTypescriptPeer({
        peerDependencies: { typescript: MIN_TYPESCRIPT_PEER },
      }),
      false,
    );
  });
});

describe('classifyPackage', () => {
  it('returns null for a conforming manifest', () => {
    strictEqual(classifyPackage(CONFORMING_PKG), null);
  });

  it('flags a missing typescript peer with reason "missing"', () => {
    const result = classifyPackage({ name: '@internal/example' });
    strictEqual(result?.name, '@internal/example');
    strictEqual(result?.reason, 'missing');
  });

  it('flags a wrong range with reason "wrong-range"', () => {
    const result = classifyPackage({
      name: '@internal/example',
      peerDependencies: { typescript: '>=5.0' },
      peerDependenciesMeta: { typescript: { optional: true } },
    });
    strictEqual(result?.name, '@internal/example');
    strictEqual(result?.reason, 'wrong-range');
  });

  it('flags a non-optional typescript peer with reason "not-optional"', () => {
    const result = classifyPackage({
      name: '@internal/example',
      peerDependencies: { typescript: MIN_TYPESCRIPT_PEER },
    });
    strictEqual(result?.name, '@internal/example');
    strictEqual(result?.reason, 'not-optional');
  });

  it('falls back to "<unnamed>" when name is missing', () => {
    const result = classifyPackage({});
    strictEqual(result?.name, '<unnamed>');
    strictEqual(result?.reason, 'missing');
  });
});

describe('runCheck', () => {
  function makeIo(overrides = {}) {
    const stderrLines = [];
    const stdoutLines = [];
    const io = {
      listPublishablePackageDirs: () => [],
      readPackageJson: () => CONFORMING_PKG,
      stdoutWrite: (s) => stdoutLines.push(s),
      stderrWrite: (s) => stderrLines.push(s),
      ...overrides,
    };
    return { io, stderrLines, stdoutLines };
  }

  it('returns 0 on a fully conforming workspace', () => {
    const { io } = makeIo({
      listPublishablePackageDirs: () => ['packages/a', 'packages/b'],
      readPackageJson: () => CONFORMING_PKG,
    });
    strictEqual(runCheck({ argv: [], io }), 0);
  });

  it('returns 1 when a publishable package is missing the typescript peer', () => {
    const { io, stderrLines } = makeIo({
      listPublishablePackageDirs: () => ['packages/a', 'packages/missing'],
      readPackageJson: (dir) =>
        dir === 'packages/missing' ? { name: '@scope/missing', version: '1.0.0' } : CONFORMING_PKG,
    });
    strictEqual(runCheck({ argv: [], io }), 1);
    const stderr = stderrLines.join('');
    strictEqual(stderr.includes('FAIL'), true);
    strictEqual(stderr.includes('@scope/missing'), true);
    strictEqual(stderr.includes('no "typescript" in peerDependencies'), true);
  });

  it('returns 1 when a publishable package declares the wrong range', () => {
    const { io, stderrLines } = makeIo({
      listPublishablePackageDirs: () => ['packages/wrong'],
      readPackageJson: () => ({
        name: '@scope/wrong',
        peerDependencies: { typescript: '>=5.0' },
        peerDependenciesMeta: { typescript: { optional: true } },
      }),
    });
    strictEqual(runCheck({ argv: [], io }), 1);
    const stderr = stderrLines.join('');
    strictEqual(stderr.includes('@scope/wrong'), true);
    strictEqual(stderr.includes('">=5.0"'), true);
  });

  it('emits structured JSON when --json is passed', () => {
    const { io, stdoutLines } = makeIo({
      listPublishablePackageDirs: () => ['packages/missing'],
      readPackageJson: () => ({ name: '@scope/missing', version: '1.0.0' }),
    });
    strictEqual(runCheck({ argv: ['--json'], io }), 1);
    const payload = JSON.parse(stdoutLines.join(''));
    strictEqual(payload.ok, false);
    strictEqual(payload.minTypescriptPeer, MIN_TYPESCRIPT_PEER);
    strictEqual(payload.offenders[0].dir, 'packages/missing');
    strictEqual(payload.offenders[0].reason, 'missing');
  });

  it('emits structured JSON with ok=true when the workspace conforms', () => {
    const { io, stdoutLines } = makeIo({
      listPublishablePackageDirs: () => ['packages/a'],
    });
    strictEqual(runCheck({ argv: ['--json'], io }), 0);
    const payload = JSON.parse(stdoutLines.join(''));
    strictEqual(payload.ok, true);
    deepStrictEqual(payload.offenders, []);
  });

  it('reports every offender, not just the first', () => {
    const { io, stdoutLines } = makeIo({
      listPublishablePackageDirs: () => ['packages/a', 'packages/b', 'packages/c'],
      readPackageJson: (dir) => {
        if (dir === 'packages/a') return CONFORMING_PKG;
        if (dir === 'packages/b') return { name: '@scope/b' };
        return {
          name: '@scope/c',
          peerDependencies: { typescript: '>=5.0' },
          peerDependenciesMeta: { typescript: { optional: true } },
        };
      },
    });
    strictEqual(runCheck({ argv: ['--json'], io }), 1);
    const payload = JSON.parse(stdoutLines.join(''));
    deepStrictEqual(payload.offenders.map((o) => o.name).sort(), ['@scope/b', '@scope/c']);
  });
});
