import { describe, expect, it } from 'vitest';
import { progressLabelForAction } from '../../src/control-api/operations/run-migration';

describe('progressLabelForAction', () => {
  it('returns an init-specific label for dbInit', () => {
    expect(progressLabelForAction('dbInit')).toBe('Initialising database across spaces');
  });

  it('returns an update-specific label for dbUpdate', () => {
    expect(progressLabelForAction('dbUpdate')).toBe('Updating database across spaces');
  });

  it('returns the migrate label for migrate', () => {
    expect(progressLabelForAction('migrate')).toBe('Running migration plan across spaces');
  });
});
