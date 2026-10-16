import { describe, expect, it } from 'vitest';
import { mapDbInitFailure } from '../../src/utils/db-init-failure';
import { mapDbUpdateFailure } from '../../src/utils/db-update-failure';
import { mapMigrateFailure } from '../../src/utils/migrate-failure';

const PROJECT = { cwd: '/work/app', configPath: undefined, dbGiven: false };

const runnerFailed = {
  code: 'RUNNER_FAILED',
  summary:
    'Operation index.Item.Item_state_idx failed during precheck: ensure index "Item_state_idx" does not exist',
  why: undefined,
  meta: {},
} as const;

function failedPrecheck(description: string, planStartsFromMarker: boolean) {
  return { operationId: 'index.Item.Item_state_idx', description, planStartsFromMarker };
}

describe('the advice for a check that fails before an operation runs', () => {
  it('on db migrate without a marker, says the name is taken and points to db sign', () => {
    const error = mapMigrateFailure(
      {
        ...runnerFailed,
        failedPrecheck: failedPrecheck('ensure index "Item_state_idx" does not exist', false),
      },
      PROJECT,
    );

    expect({ why: error.why, fix: error.fix }).toEqual({
      why: 'Before operation index.Item.Item_state_idx runs, it checks: ensure index "Item_state_idx" does not exist. That check failed: the database already has index "Item_state_idx".',
      fix: 'The database has no migration marker, so `{bin} db migrate` applies every migration from the first, and the database may already be ahead of this one. If its schema already matches the contract, adopt it with `{bin} db sign` instead.',
    });
  });

  it('on db migrate with a marker, says the database drifted from its migration history and points to db verify', () => {
    const error = mapMigrateFailure(
      {
        ...runnerFailed,
        failedPrecheck: failedPrecheck('ensure column "x" is missing', true),
      },
      PROJECT,
    );

    expect({ why: error.why, fix: error.fix }).toEqual({
      why: 'Before operation index.Item.Item_state_idx runs, it checks: ensure column "x" is missing. That check failed: the database already has column "x".',
      fix: 'The database has drifted from its migration history: it is not in the state the migrations before this one leave. See how it differs from the contract with `{bin} db verify`, change the database or the migration so they agree, and run `{bin} db migrate` again.',
    });
  });

  it('reads a check that something exists, and leaves any other check as written', () => {
    const whyOf = (description: string) =>
      mapMigrateFailure(
        { ...runnerFailed, failedPrecheck: failedPrecheck(description, true) },
        PROJECT,
      ).why;

    expect([
      whyOf('ensure constraint "Item_pkey" exists'),
      whyOf('collection items does not exist'),
      whyOf('ensure no NULL values in "note"'),
    ]).toEqual([
      'Before operation index.Item.Item_state_idx runs, it checks: ensure constraint "Item_pkey" exists. That check failed: the database has no constraint "Item_pkey".',
      'Before operation index.Item.Item_state_idx runs, it checks: collection items does not exist. That check failed: the database already has collection items.',
      'Before operation index.Item.Item_state_idx runs, it checks: ensure no NULL values in "note". That check failed on this database.',
    ]);
  });

  it('on db init, points to db sign', () => {
    const error = mapDbInitFailure(
      {
        ...runnerFailed,
        conflicts: undefined,
        failedPrecheck: failedPrecheck('ensure index "Item_state_idx" does not exist', false),
      },
      PROJECT,
    );

    expect(error.fix).toBe(
      'The database already holds part of the schema `{bin} db init` would create. If its schema already matches the contract, adopt it with `{bin} db sign` instead.',
    );
  });

  it('on db update, explains the check that failed', () => {
    const error = mapDbUpdateFailure(
      {
        ...runnerFailed,
        conflicts: undefined,
        failedPrecheck: failedPrecheck('ensure index "Item_state_idx" does not exist', true),
      },
      PROJECT,
    );

    expect(error.why).toBe(
      'Before operation index.Item.Item_state_idx runs, it checks: ensure index "Item_state_idx" does not exist. That check failed: the database already has index "Item_state_idx".',
    );
  });
});
