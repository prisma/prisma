import { describe, expect, it } from 'vitest';
import { mapDbUpdateFailure } from '../../src/utils/db-update-failure';
import { mapMigrateFailure } from '../../src/utils/migrate-failure';

const PROJECT = { cwd: '/work/app', configPath: undefined, dbGiven: false };

const blocked = {
  code: 'RUNNER_FAILED',
  summary:
    'Table "billing"."audit_log" cannot be dropped while view billing.v_paid depends on it. Drop or change it yourself, then run the command again.',
  why: 'cannot drop table billing.audit_log because other objects depend on it',
  meta: {},
  conflicts: undefined,
  blockingObjects: [{ kind: 'view', name: 'billing.v_paid' }],
} as const;

describe('the advice for an operation that objects in the database block', () => {
  it('on db update, says to drop or change the objects named, then run it again', () => {
    expect(mapDbUpdateFailure(blocked, PROJECT, ['--delete', 'billing']).fix).toBe(
      'Drop or change view billing.v_paid in the database yourself, then re-run `{bin} db update --delete billing`.',
    );
  });

  it('on db migrate, says the same', () => {
    expect(mapMigrateFailure(blocked, PROJECT).fix).toBe(
      'Drop or change view billing.v_paid in the database yourself, then re-run `{bin} db migrate`.',
    );
  });
});
