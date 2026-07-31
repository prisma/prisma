import { describe, expect, it, vi } from 'vitest';
import { classifyPackage, isAcceptedLicense, runCheck } from './validate-package-manifests.mjs';

describe('isAcceptedLicense', () => {
  it('accepts the SPDX identifier "Apache-2.0"', () => {
    expect(isAcceptedLicense('Apache-2.0')).toBe(true);
  });

  it('rejects other SPDX identifiers, even compatible ones', () => {
    expect(isAcceptedLicense('MIT')).toBe(false);
    expect(isAcceptedLicense('BSD-3-Clause')).toBe(false);
    expect(isAcceptedLicense('Apache-2.0 OR MIT')).toBe(false);
    expect(isAcceptedLicense('SEE LICENSE IN LICENSE')).toBe(false);
  });

  it('rejects loose / undeclared values', () => {
    expect(isAcceptedLicense(undefined)).toBe(false);
    expect(isAcceptedLicense(null)).toBe(false);
    expect(isAcceptedLicense('')).toBe(false);
    expect(isAcceptedLicense('UNLICENSED')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isAcceptedLicense(0)).toBe(false);
    expect(isAcceptedLicense(true)).toBe(false);
    expect(isAcceptedLicense({ type: 'Apache-2.0' })).toBe(false);
  });
});

describe('classifyPackage', () => {
  it('returns null for a conforming manifest', () => {
    expect(
      classifyPackage({
        name: '@internal/example',
        version: '1.0.0',
        license: 'Apache-2.0',
      }),
    ).toBeNull();
  });

  it('flags a missing license field with reason "missing"', () => {
    expect(
      classifyPackage({
        name: '@internal/example',
        version: '1.0.0',
      }),
    ).toEqual({
      name: '@internal/example',
      license: undefined,
      reason: 'missing',
    });
  });

  it('flags an empty-string license with reason "missing"', () => {
    expect(
      classifyPackage({
        name: '@internal/example',
        license: '',
      }),
    ).toEqual({
      name: '@internal/example',
      license: '',
      reason: 'missing',
    });
  });

  it('flags a wrong-value license with reason "wrong" and preserves the value', () => {
    expect(
      classifyPackage({
        name: '@internal/example',
        license: 'MIT',
      }),
    ).toEqual({
      name: '@internal/example',
      license: 'MIT',
      reason: 'wrong',
    });
  });

  it('flags a malformed license object with reason "wrong"', () => {
    expect(
      classifyPackage({
        name: '@internal/example',
        license: { type: 'Apache-2.0', url: 'https://example.com' },
      }),
    ).toMatchObject({
      name: '@internal/example',
      reason: 'wrong',
    });
  });

  it('falls back to "<unnamed>" when name is missing (defence in depth)', () => {
    expect(classifyPackage({})).toEqual({
      name: '<unnamed>',
      license: undefined,
      reason: 'missing',
    });
  });
});

describe('runCheck', () => {
  function makeIo(overrides = {}) {
    return {
      listPublishablePackageDirs: () => [],
      readPackageJson: () => ({ name: '@scope/x', version: '1.0.0', license: 'Apache-2.0' }),
      stdoutWrite: vi.fn(),
      stderrWrite: vi.fn(),
      ...overrides,
    };
  }

  it('returns 0 on a fully conforming workspace', () => {
    const io = makeIo({
      listPublishablePackageDirs: () => ['packages/a', 'packages/b'],
      readPackageJson: (dir) => ({
        name: `@scope/${dir.split('/').pop()}`,
        version: '1.0.0',
        license: 'Apache-2.0',
      }),
    });
    expect(runCheck({ argv: [], io })).toBe(0);
    expect(io.stdoutWrite).not.toHaveBeenCalled();
  });

  it('returns 1 when a publishable package is missing a license', () => {
    const io = makeIo({
      listPublishablePackageDirs: () => ['packages/a', 'packages/missing'],
      readPackageJson: (dir) =>
        dir === 'packages/missing'
          ? { name: '@scope/missing', version: '1.0.0' }
          : { name: '@scope/a', version: '1.0.0', license: 'Apache-2.0' },
    });
    expect(runCheck({ argv: [], io })).toBe(1);
    const stderr = io.stderrWrite.mock.calls.map((c) => c[0]).join('');
    expect(stderr).toMatch(/FAIL/);
    expect(stderr).toMatch(/@scope\/missing/);
    expect(stderr).toMatch(/no "license" field/);
  });

  it('returns 1 when a publishable package declares the wrong license', () => {
    const io = makeIo({
      listPublishablePackageDirs: () => ['packages/wrong'],
      readPackageJson: () => ({ name: '@scope/wrong', version: '1.0.0', license: 'MIT' }),
    });
    expect(runCheck({ argv: [], io })).toBe(1);
    const stderr = io.stderrWrite.mock.calls.map((c) => c[0]).join('');
    expect(stderr).toMatch(/@scope\/wrong/);
    expect(stderr).toMatch(/"MIT"/);
    expect(stderr).toMatch(/expected "Apache-2.0"/);
  });

  it('emits structured JSON when --json is passed', () => {
    const io = makeIo({
      listPublishablePackageDirs: () => ['packages/missing'],
      readPackageJson: () => ({ name: '@scope/missing', version: '1.0.0' }),
    });
    expect(runCheck({ argv: ['--json'], io })).toBe(1);
    expect(io.stdoutWrite).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(io.stdoutWrite.mock.calls[0][0]);
    expect(payload.ok).toBe(false);
    expect(payload.offenders).toEqual([
      {
        dir: 'packages/missing',
        name: '@scope/missing',
        license: undefined,
        reason: 'missing',
      },
    ]);
  });

  it('emits structured JSON with ok=true when the workspace conforms', () => {
    const io = makeIo({
      listPublishablePackageDirs: () => ['packages/a'],
    });
    expect(runCheck({ argv: ['--json'], io })).toBe(0);
    const payload = JSON.parse(io.stdoutWrite.mock.calls[0][0]);
    expect(payload).toEqual({ ok: true, offenders: [] });
  });

  it('reports every offender, not just the first', () => {
    const io = makeIo({
      listPublishablePackageDirs: () => ['packages/a', 'packages/b', 'packages/c'],
      readPackageJson: (dir) => {
        if (dir === 'packages/a') return { name: '@scope/a', license: 'Apache-2.0' };
        if (dir === 'packages/b') return { name: '@scope/b' };
        return { name: '@scope/c', license: 'GPL-3.0' };
      },
    });
    expect(runCheck({ argv: ['--json'], io })).toBe(1);
    const payload = JSON.parse(io.stdoutWrite.mock.calls[0][0]);
    expect(payload.offenders.map((o) => o.name).sort()).toEqual(['@scope/b', '@scope/c']);
  });
});
