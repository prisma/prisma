import { describe, expect, it } from 'vitest';
import { setupIntegrationTest, timeouts } from './setup';

describe('integration: LIMIT / OFFSET', { timeout: timeouts.databaseOperation }, () => {
  const { db, runtime } = setupIntegrationTest();

  it('LIMIT restricts row count', async () => {
    const rows = await runtime().execute(
      db().public.users.select('id').orderBy('id').limit(2).build(),
    );
    expect(rows).toHaveLength(2);
  });

  it('OFFSET skips rows', async () => {
    const rows = await runtime().execute(
      db().public.users.select('id').orderBy('id').offset(2).build(),
    );
    expect(rows[0]!.id).toBe(3);
  });

  it('LIMIT + OFFSET paginates correctly', async () => {
    const rows = await runtime().execute(
      db().public.users.select('id').orderBy('id').limit(2).offset(1).build(),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe(2);
    expect(rows[1]!.id).toBe(3);
  });
});
