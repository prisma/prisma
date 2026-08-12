import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import type { CliErrorConflict, CliErrorEnvelope } from '../src/utils/cli-errors';
import { formatErrorOutput } from '../src/utils/formatters/errors';
import { parseGlobalFlags } from '../src/utils/global-flags';

const baseError: CliErrorEnvelope = {
  ok: false,
  code: 'MIGRATION.PLANNING_FAILED',
  severity: 'error',
  summary: 'Migration planning failed',
  why: 'Conflicts detected',
  fix: 'Resolve conflicts',
  nextActions: [],
};

const createConflicts = (): readonly CliErrorConflict[] => [
  { kind: 'table', summary: 'First conflict' },
  { kind: 'column', summary: 'Second conflict' },
  { kind: 'index', summary: 'Third conflict' },
  { kind: 'constraint', summary: 'Fourth conflict' },
];

describe('formatErrorOutput - why/fix rendering', () => {
  it('shows Fix line when fix is identical to why', () => {
    const error: CliErrorEnvelope = {
      ...baseError,
      why: 'Something went wrong',
      fix: 'Something went wrong',
    };

    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatErrorOutput(error, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Why: Something went wrong');
    expect(stripped).toContain('Fix: Something went wrong');
  });

  it('shows both Why and Fix when they differ', () => {
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatErrorOutput(baseError, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Why: Conflicts detected');
    expect(stripped).toContain('Fix: Resolve conflicts');
  });
});

describe('formatErrorOutput - conflicts', () => {
  it('shows truncated conflict list when not verbose', () => {
    const conflicts = createConflicts();
    const error: CliErrorEnvelope = {
      ...baseError,
      meta: { conflicts },
    };

    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatErrorOutput(error, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Conflicts (showing 3 of 4):');
    expect(stripped).toContain('[table] First conflict');
    expect(stripped).toContain('[column] Second conflict');
    expect(stripped).toContain('[index] Third conflict');
    expect(stripped).not.toContain('[constraint] Fourth conflict');
    expect(stripped).toContain('Re-run with -v/--verbose to see all conflicts');
  });

  it('shows full conflict list when verbose', () => {
    const conflicts = createConflicts();
    const error: CliErrorEnvelope = {
      ...baseError,
      meta: { conflicts },
    };

    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });
    const output = formatErrorOutput(error, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Conflicts:');
    expect(stripped).toContain('[table] First conflict');
    expect(stripped).toContain('[column] Second conflict');
    expect(stripped).toContain('[index] Third conflict');
    expect(stripped).toContain('[constraint] Fourth conflict');
  });
});

describe('formatErrorOutput - issues list label and body fallback', () => {
  it('renders a PSL-diagnostic issue as `[kind] message`', () => {
    // PSL interpretation diagnostics stamp `kind` (their diagnostic code) and `message` (their prose).
    const error: CliErrorEnvelope = {
      ...baseError,
      code: 'CONTRACT.SOURCE_LOAD_FAILED',
      summary: 'Failed to resolve contract source',
      meta: {
        issues: [{ kind: 'PSL_ORPHANED_BACKRELATION', message: 'orphaned backrelation list' }],
      },
    };

    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });
    const stripped = stripAnsi(formatErrorOutput(error, flags));

    expect(stripped).toContain('[PSL_ORPHANED_BACKRELATION] orphaned backrelation list');
  });

  it('renders a schema-diff issue (no `message`) with a presence-derived `[missing] path/joined/with/slashes` label', () => {
    // Schema-diff issues (SchemaDiffIssue) carry no `message`; they stamp
    // `path` plus the `expected`/`actual` presence the label derives from.
    const error: CliErrorEnvelope = {
      ...baseError,
      code: 'CONTRACT.SOURCE_LOAD_FAILED',
      summary: 'Failed to resolve contract source',
      meta: {
        // expected-only → a missing object.
        issues: [{ path: ['public', 'post'], expected: {} }],
      },
    };

    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });
    const stripped = stripAnsi(formatErrorOutput(error, flags));

    expect(stripped).toContain('[missing] public/post');
  });
});

describe('formatErrorOutput - planner warnings on apply failure', () => {
  it('prints a Warnings block when meta carries plannerWarnings', () => {
    const error: CliErrorEnvelope = {
      ...baseError,
      code: 'MIGRATION.RUNNER_FAILED',
      summary: 'Database schema does not satisfy contract (1 failure)',
      why: 'The resulting database schema does not satisfy the destination contract.',
      fix: 'Inspect the reported conflict, reconcile schema drift if needed, then re-run `prisma-next db update`',
      meta: {
        plannerWarnings: [
          {
            kind: 'controlPolicySuppressedCall',
            summary:
              "control policy suppressed: createTable(auth.sessions) — namespace 'auth' has effective control 'external' but table declared 'managed'",
          },
        ],
      },
    };

    const stripped = stripAnsi(formatErrorOutput(error, parseGlobalFlags({ 'no-color': true })));

    expect(stripped).toContain('Warnings:');
    expect(stripped).toContain('control policy suppressed: createTable(auth.sessions)');
    expect(stripped).toContain('Database schema does not satisfy contract');
  });
});
