import { describe, expect, it } from 'vitest';
import { setupIntegrationTest, timeouts } from './setup';

describe('integration: DISTINCT', { timeout: timeouts.databaseOperation }, () => {
  const { db, runtime } = setupIntegrationTest();

  it('DISTINCT removes duplicate rows', async () => {
    const rows = await runtime().execute(db().public.posts.select('user_id').distinct().build());
    const userIds = rows.map((r) => r.user_id);
    expect(new Set(userIds).size).toBe(userIds.length);
    expect(userIds.length).toBe(3);
  });

  it('DISTINCT ON selects first row per group', async () => {
    const rows = await runtime().execute(
      db().public.posts.select('user_id', 'title').distinctOn('user_id').orderBy('user_id').build(),
    );
    expect(rows).toHaveLength(3);
    const userIds = rows.map((r) => r.user_id);
    expect(new Set(userIds).size).toBe(3);
  });
});
