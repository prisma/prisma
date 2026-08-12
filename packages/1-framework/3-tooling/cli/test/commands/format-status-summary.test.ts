import { describe, expect, it } from 'vitest';
import {
  buildNoPathSummary,
  buildStatusHeadline,
  formatStatusSummary,
  type StatusDiagnosticJson,
} from '../../src/commands/migration-status';

const baseResult = {
  ok: true as const,
  spaces: [],
  summary: 'Up to date',
  diagnostics: [],
  treeSections: [],
};

describe('buildNoPathSummary', () => {
  it('names the live contract when no --to was passed', () => {
    expect(
      buildNoPathSummary({
        markerHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        targetHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        explicitTarget: false,
        refName: undefined,
      }),
    ).toBe(
      "No migration path from the database state (aaaaaaaaaaaa) to the application's contract (bbbbbbbbbbbb). Run `prisma-next migration plan --name <name>` to author one.",
    );
  });

  it('names the ref when --to resolved via ref', () => {
    expect(
      buildNoPathSummary({
        markerHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        targetHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        explicitTarget: true,
        refName: 'prod',
      }),
    ).toBe(
      'No migration path from the database state (aaaaaaaaaaaa) to the target (bbbbbbbbbbbb via `prod`). Run `prisma-next migration plan --name <name>` to author one, or pass `--to <contract>` to pick a reachable target.',
    );
  });

  it('omits via ref when --to was a raw hash', () => {
    expect(
      buildNoPathSummary({
        markerHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        targetHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        explicitTarget: true,
        refName: undefined,
      }),
    ).toBe(
      'No migration path from the database state (aaaaaaaaaaaa) to the target (bbbbbbbbbbbb). Run `prisma-next migration plan --name <name>` to author one, or pass `--to <contract>` to pick a reachable target.',
    );
  });

  it('omits marker parenthetical when marker hash is unknown', () => {
    expect(
      buildNoPathSummary({
        markerHash: undefined,
        targetHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        explicitTarget: false,
        refName: undefined,
      }),
    ).toBe(
      "No migration path from the database state to the application's contract (bbbbbbbbbbbb). Run `prisma-next migration plan --name <name>` to author one.",
    );
  });
});

describe('buildStatusHeadline', () => {
  it('reports up to date when nothing is pending', () => {
    expect(
      buildStatusHeadline({
        pendingCount: 0,
        targetHash: 'abc',
        markerDiverged: false,
        markerHash: 'abc',
      }),
    ).toBe('Up to date');
  });

  it('names the migrate target when migrations are pending', () => {
    expect(
      buildStatusHeadline({
        pendingCount: 2,
        targetHash: 'deadbeef',
        markerDiverged: false,
        markerHash: 'marker',
      }),
    ).toBe('2 pending — run `prisma-next migrate --to deadbeef`');
  });
});

describe('formatStatusSummary', () => {
  it('includes the missing-invariants line when a MIGRATION.MISSING_INVARIANTS diagnostic is present', () => {
    const diagnostics: StatusDiagnosticJson[] = [
      {
        code: 'MIGRATION.MISSING_INVARIANTS',
        invariants: ['users-have-email'],
        message: 'missing invariant(s): users-have-email',
      },
    ];
    const out = formatStatusSummary({ ...baseResult, diagnostics }, false);
    expect(out).toContain('Up to date');
    expect(out).toContain('missing invariant(s): users-have-email');
  });

  it('highlights divergence warnings', () => {
    const diagnostics: StatusDiagnosticJson[] = [
      {
        code: 'MIGRATION.MARKER_NOT_IN_HISTORY',
        severity: 'warn',
        message: 'marker diverged',
        hints: [],
      },
    ];
    const out = formatStatusSummary(
      {
        ...baseResult,
        summary: 'Database marker abcdef is not in the on-disk migration graph',
        diagnostics,
      },
      false,
    );
    expect(out).toContain('Database marker abcdef');
  });
});
