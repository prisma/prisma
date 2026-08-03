import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findLeaks, isLeak, runCheck } from './check-publish-deps.mjs';

function recorder() {
  const calls = [];
  const fn = (...args) => calls.push(args);
  fn.calls = calls;
  return fn;
}

describe('isLeak', () => {
  it('flags workspace:* specifiers', () => {
    assert.equal(isLeak('workspace:*'), true);
    assert.equal(isLeak('workspace:^1.2.3'), true);
  });

  it('flags catalog: specifiers (named and default)', () => {
    assert.equal(isLeak('catalog:'), true);
    assert.equal(isLeak('catalog:default'), true);
    assert.equal(isLeak('catalog:react18'), true);
  });

  it('does not flag real version ranges or git/file/npm specifiers', () => {
    assert.equal(isLeak('^1.2.3'), false);
    assert.equal(isLeak('1.2.3'), false);
    assert.equal(isLeak('~1.2.0'), false);
    assert.equal(isLeak('npm:foo@^1.0.0'), false);
    assert.equal(isLeak('git+https://github.com/foo/bar.git'), false);
    assert.equal(isLeak('file:../local'), false);
  });

  it('returns false for non-strings (null/undefined/number/object)', () => {
    assert.equal(isLeak(undefined), false);
    assert.equal(isLeak(null), false);
    assert.equal(isLeak(0), false);
    assert.equal(isLeak({}), false);
  });
});

describe('findLeaks', () => {
  it('returns an empty array for a clean manifest', () => {
    assert.deepEqual(
      findLeaks({
        name: '@scope/clean',
        version: '1.0.0',
        dependencies: { foo: '^1.0.0', bar: '~2.1.3' },
      }),
      [],
    );
  });

  it('returns one leak per offender, tagging the field it came from', () => {
    const leaks = findLeaks({
      name: '@scope/dirty',
      version: '1.0.0',
      dependencies: {
        clean: '^1.0.0',
        leaky: 'workspace:*',
      },
      devDependencies: {
        catty: 'catalog:',
      },
    });
    assert.deepEqual(leaks, [
      { field: 'dependencies', name: 'leaky', spec: 'workspace:*' },
      { field: 'devDependencies', name: 'catty', spec: 'catalog:' },
    ]);
  });

  it('walks all four pnpm dependency fields', () => {
    const leaks = findLeaks({
      dependencies: { a: 'workspace:*' },
      devDependencies: { b: 'workspace:^1.0.0' },
      peerDependencies: { c: 'catalog:' },
      optionalDependencies: { d: 'catalog:vendored' },
    });
    assert.deepEqual(leaks.map((l) => l.field).sort(), [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]);
  });

  it('ignores unknown dependency-shaped fields (resolutions, overrides) by design', () => {
    const leaks = findLeaks({
      dependencies: { clean: '^1.0.0' },
      resolutions: { 'something/else': 'workspace:*' },
      overrides: { 'foo/bar': 'catalog:' },
    });
    assert.deepEqual(leaks, []);
  });

  it('tolerates a malformed manifest without throwing', () => {
    assert.deepEqual(findLeaks({}), []);
    assert.deepEqual(findLeaks({ dependencies: null }), []);
    assert.deepEqual(findLeaks({ dependencies: 'not-an-object' }), []);
  });

  it('preserves enumeration order within a field (deterministic CI output)', () => {
    const leaks = findLeaks({
      dependencies: {
        first: 'workspace:*',
        clean: '^1.0.0',
        second: 'catalog:',
      },
    });
    assert.deepEqual(
      leaks.map((l) => l.name),
      ['first', 'second'],
    );
  });
});

describe('runCheck', () => {
  function makeIo(overrides = {}) {
    const rm = recorder();
    return {
      rm,
      io: {
        listPublishablePackageDirs: () => [],
        mkdtemp: () => '/tmp/pn-publish-check-fake',
        rm,
        readdirSync: () => [],
        readPackageJson: () => ({ name: '@scope/x', version: '1.0.0' }),
        readPackedManifest: () => ({}),
        readPackedDeclarations: () => new Map(),
        dependencyShipsOwnTypes: () => true,
        packAll: () => 0,
        stdoutWrite: () => {},
        stderrWrite: () => {},
        ...overrides,
      },
    };
  }

  it('removes the tmpdir even when packAll fails (acceptance: failure-path cleanup)', () => {
    const { io, rm } = makeIo({ packAll: () => 2 });
    const exit = runCheck({ argv: [], io });
    assert.equal(exit, 2);
    assert.deepEqual(rm.calls, [['/tmp/pn-publish-check-fake']]);
  });

  it('removes the tmpdir even when scanning throws (defence in depth)', () => {
    const { io, rm } = makeIo({
      readdirSync: () => {
        throw new Error('scan exploded');
      },
    });
    assert.throws(() => runCheck({ argv: [], io }), /scan exploded/);
    assert.deepEqual(rm.calls, [['/tmp/pn-publish-check-fake']]);
  });

  it('returns 0 and removes the tmpdir on a clean run', () => {
    const { io, rm } = makeIo();
    assert.equal(runCheck({ argv: [], io }), 0);
    assert.equal(rm.calls.length, 1);
  });

  it('returns 1 when offenders are found and still removes the tmpdir', () => {
    const { io, rm } = makeIo({
      listPublishablePackageDirs: () => ['packages/foo'],
      readdirSync: () => ['scope-foo-1.0.0.tgz'],
      readPackageJson: () => ({ name: '@scope/foo', version: '1.0.0' }),
      readPackedManifest: () => ({
        dependencies: { bad: 'workspace:*' },
      }),
    });
    assert.equal(runCheck({ argv: [], io }), 1);
    assert.equal(rm.calls.length, 1);
  });

  it('emits structured JSON when --json is passed', () => {
    const stdoutWrite = recorder();
    const { io, rm } = makeIo({
      listPublishablePackageDirs: () => ['packages/foo'],
      readdirSync: () => ['scope-foo-1.0.0.tgz'],
      readPackageJson: () => ({ name: '@scope/foo', version: '1.0.0' }),
      readPackedManifest: () => ({
        dependencies: { bad: 'workspace:*' },
      }),
      stdoutWrite,
    });

    assert.equal(runCheck({ argv: ['--json'], io }), 1);
    assert.equal(stdoutWrite.calls.length, 1);

    const payload = JSON.parse(stdoutWrite.calls[0][0]);
    assert.equal(payload.ok, false);
    assert.equal(payload.offenders.length, 1);
    assert.equal(payload.offenders[0].pkg, '@scope/foo');
    assert.equal(payload.offenders[0].tarball, 'scope-foo-1.0.0.tgz');
    assert.deepEqual(payload.offenders[0].leaks, [
      { field: 'dependencies', name: 'bad', spec: 'workspace:*' },
    ]);
    assert.equal(rm.calls.length, 1);
  });
});
