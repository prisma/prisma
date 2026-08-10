import { describe, expect, it } from 'vitest';
import { copyGlobFrom, isExternalSpecifier } from '../shell-build';

describe('isExternalSpecifier', () => {
  it('keeps third-party and sibling-shell specifiers external', () => {
    expect(isExternalSpecifier('tsdown')).toBe(true);
    expect(isExternalSpecifier('@prisma/orm-postgres')).toBe(true);
  });

  it('bundles the internal packages a shell owns', () => {
    expect(isExternalSpecifier('@internal/contract/types')).toBe(false);
  });

  it('bundles resolved ids, whichever platform resolved them', () => {
    expect(isExternalSpecifier('/repo/packages/1-framework/contract/dist/types.mjs')).toBe(false);
    expect(
      isExternalSpecifier(String.raw`C:\repo\packages\1-framework\contract\dist\types.mjs`),
    ).toBe(false);
    expect(isExternalSpecifier('C:/repo/packages/1-framework/contract/dist/types.mjs')).toBe(false);
  });
});

describe('copyGlobFrom', () => {
  it('roots the glob at the repository without platform separators', () => {
    const from = copyGlobFrom(process.cwd(), 'packages/1-framework/3-tooling/cli/dist/*.md');

    expect(from).not.toContain('\\');
    expect(from.endsWith('/packages/1-framework/3-tooling/cli/dist/*.md')).toBe(true);
  });
});
