import { describe, expect, it } from 'vitest';
import { setupIntegrationTest, timeouts } from './setup';

describe('integration: GROUP BY / HAVING', { timeout: timeouts.databaseOperation }, () => {
  const { db, runtime } = setupIntegrationTest();

  it('GROUP BY with COUNT', async () => {
    const rows = await runtime().execute(
      db()
        .public.posts.select('user_id')
        .select('cnt', (_f, fns) => fns.count())
        .groupBy('user_id')
        .orderBy('user_id')
        .build(),
    );
    expect(rows.length).toBeGreaterThan(0);
    const alice = rows.find((r) => r.user_id === 1);
    // The count reads through the codec its target declares for it — the
    // roadmap's remaining aggregate: text off the wire, a bigint in hand.
    expect(alice!.cnt).toBe(2n);
  });

  // `count(x)` counts non-null values rather than rows, and resolves through
  // the same input-agnostic overload as `count()` — the case that has no answer
  // under a matching scheme keyed only on the input.
  it('GROUP BY with COUNT over a column', async () => {
    const rows = await runtime().execute(
      db()
        .public.posts.select('user_id')
        .select('cnt', (f, fns) => fns.count(f.posts.views))
        .groupBy('user_id')
        .orderBy('user_id')
        .build(),
    );
    const alice = rows.find((r) => r.user_id === 1);
    expect(alice!.cnt).toBe(2n);
  });

  it('HAVING filters groups', async () => {
    const rows = await runtime().execute(
      db()
        .public.posts.select('user_id')
        .select('cnt', (_f, fns) => fns.count())
        .groupBy('user_id')
        .having((_f, fns) => fns.gt(fns.count(), 1n))
        .build(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.user_id).toBe(1);
  });
});
