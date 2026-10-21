import { isStructuredError } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import {
  migrationRunnerFailure,
  withFailingSpace,
  withRolledBack,
} from '../src/control/control-migration-types';

describe('migrationRunnerFailure', () => {
  it('builds a structured error with the summary as its message', () => {
    const failure = migrationRunnerFailure('MIGRATION.PRECHECK_FAILED', 'Operation op failed', {
      why: 'The check did not hold.',
      meta: { failedCheck: { operationId: 'op', phase: 'precheck', description: 'check' } },
    });

    expect(isStructuredError(failure)).toBe(true);
    expect(failure).toBeInstanceOf(Error);
    expect({
      code: failure.code,
      message: failure.message,
      why: failure.why,
      meta: failure.meta,
    }).toEqual({
      code: 'MIGRATION.PRECHECK_FAILED',
      message: 'Operation op failed',
      why: 'The check did not hold.',
      meta: { failedCheck: { operationId: 'op', phase: 'precheck', description: 'check' } },
    });
  });

  it('has empty meta when none is given', () => {
    const failure = migrationRunnerFailure('MIGRATION.MARKER_CAS_FAILURE', 'Marker changed');

    expect({ meta: failure.meta, hasWhy: 'why' in failure }).toEqual({ meta: {}, hasWhy: false });
  });
});

describe('withFailingSpace', () => {
  it('keeps the message, code, why and meta, and adds the space to meta', () => {
    const cause = new Error('driver error');
    const original = migrationRunnerFailure('MIGRATION.SCHEMA_VERIFY_FAILED', 'Schema differs', {
      why: 'The resulting schema does not satisfy the contract.',
      meta: { schemaIssues: [], sqlState: '42P01' },
      cause,
    });

    const failure = withFailingSpace(original, 'app');

    expect(isStructuredError(failure)).toBe(true);
    expect(failure).toBeInstanceOf(Error);
    expect({
      code: failure.code,
      message: failure.message,
      why: failure.why,
      meta: failure.meta,
      cause: failure.cause,
    }).toEqual({
      code: 'MIGRATION.SCHEMA_VERIFY_FAILED',
      message: 'Schema differs',
      why: 'The resulting schema does not satisfy the contract.',
      meta: { schemaIssues: [], sqlState: '42P01', failingSpace: 'app' },
      cause,
    });
    expect(failure.stack).toBe(original.stack);
  });

  it('leaves the original failure unchanged', () => {
    const original = migrationRunnerFailure('MIGRATION.EXECUTION_FAILED', 'Step failed');

    withFailingSpace(original, 'ext');

    expect(original.meta).toEqual({});
  });
});

describe('withRolledBack', () => {
  it('keeps the failure and says in meta whether the apply was rolled back', () => {
    const original = migrationRunnerFailure('MIGRATION.SCHEMA_VERIFY_FAILED', 'Schema differs', {
      meta: { schemaIssues: [], failingSpace: 'app' },
    });

    expect(
      [true, false].map((rolledBack) => {
        const failure = withRolledBack(original, rolledBack);
        return { code: failure.code, message: failure.message, meta: failure.meta };
      }),
    ).toEqual([
      {
        code: 'MIGRATION.SCHEMA_VERIFY_FAILED',
        message: 'Schema differs',
        meta: { schemaIssues: [], failingSpace: 'app', rolledBack: true },
      },
      {
        code: 'MIGRATION.SCHEMA_VERIFY_FAILED',
        message: 'Schema differs',
        meta: { schemaIssues: [], failingSpace: 'app', rolledBack: false },
      },
    ]);
  });
});
