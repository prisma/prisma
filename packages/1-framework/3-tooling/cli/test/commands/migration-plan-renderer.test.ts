import { describe, expect, it } from 'vitest';
import { formatMigrationPlanOutput } from '../../src/commands/migration-plan';
import type { MigrationPlanResult } from '../../src/control-api/operations/migration-plan';
import type { GlobalFlags } from '../../src/utils/global-flags';

const HASH_A = `${'a'.repeat(8)}`;
const HASH_B = `${'b'.repeat(8)}`;
const NO_COLOR_FLAGS = {
  format: 'pretty',
  explicitFormat: false,
  color: false,
} as const satisfies GlobalFlags;

function makeNoOpResult(
  emitted: readonly { readonly spaceId: string; readonly dirName: string }[],
): MigrationPlanResult {
  return {
    ok: true,
    noOp: true,
    from: HASH_A,
    to: HASH_A,
    operations: [],
    emittedExtensionDirs: emitted,
    summary: 'No changes detected between contracts',
    timings: { total: 0 },
  };
}

function makePlaceholderResult(
  emitted: readonly { readonly spaceId: string; readonly dirName: string }[],
): MigrationPlanResult {
  return {
    ok: true,
    noOp: false,
    from: HASH_A,
    to: HASH_B,
    dir: 'migrations/app/20260101000000_x',
    operations: [],
    emittedExtensionDirs: emitted,
    pendingPlaceholders: true,
    summary:
      'Planned migration with placeholder(s) — edit migration.ts then run `node migration.ts` to self-emit',
    timings: { total: 0 },
  };
}

describe('formatMigrationPlanOutput: extension materialisation surfaces in short-circuit branches', () => {
  describe('noOp branch', () => {
    it('omits the extension block and apply hint when no extensions emitted', () => {
      const out = formatMigrationPlanOutput(makeNoOpResult([]), NO_COLOR_FLAGS);

      expect(out).toContain('No changes detected');
      expect(out).not.toContain('Emitted extension migrations:');
      expect(out).not.toContain('prisma-next migrate');
    });

    it('surfaces emitted extension directories and apply hint when extensions emitted', () => {
      const out = formatMigrationPlanOutput(
        makeNoOpResult([
          { spaceId: 'audit', dirName: '20260101000000_bump' },
          { spaceId: 'flags', dirName: '20260102000000_bump' },
        ]),
        NO_COLOR_FLAGS,
      );

      expect(out).toContain('No changes detected');
      expect(out).toContain('Emitted extension migrations:');
      expect(out).toContain('audit → migrations/audit/20260101000000_bump');
      expect(out).toContain('flags → migrations/flags/20260102000000_bump');
      expect(out).toContain('prisma-next migrate');
    });
  });

  describe('placeholder branch', () => {
    it('omits the extension block when no extensions emitted', () => {
      const out = formatMigrationPlanOutput(makePlaceholderResult([]), NO_COLOR_FLAGS);

      expect(out).toContain('placeholder');
      expect(out).not.toContain('Emitted extension migrations:');
      expect(out).not.toContain('prisma-next migrate');
    });

    it('surfaces emitted extension directories and apply hint when extensions emitted', () => {
      const out = formatMigrationPlanOutput(
        makePlaceholderResult([{ spaceId: 'audit', dirName: '20260101000000_bump' }]),
        NO_COLOR_FLAGS,
      );

      expect(out).toContain('placeholder');
      expect(out).toContain('Emitted extension migrations:');
      expect(out).toContain('audit → migrations/audit/20260101000000_bump');
      expect(out).toContain('prisma-next migrate');
    });
  });
});
