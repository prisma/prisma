import { describe, expect, it } from 'vitest';
import { setupIntegrationTest, timeouts } from './setup';

describe('integration: ilike (adapter operation)', { timeout: timeouts.databaseOperation }, () => {
  const { db, runtime } = setupIntegrationTest();

  it('ilike filters case-insensitively in WHERE', async () => {
    const rows = await runtime().execute(
      db()
        .public.users.select('id', 'name')
        .where((f, fns) => fns.ilike(f.name, '%alice%'))
        .build(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Alice');
  });

  it('ilike returns no rows when pattern does not match', async () => {
    const rows = await runtime().execute(
      db()
        .public.users.select('id')
        .where((f, fns) => fns.ilike(f.name, '%zzz%'))
        .build(),
    );
    expect(rows).toHaveLength(0);
  });
});

describe('integration: extension functions', { timeout: timeouts.databaseOperation }, () => {
  const { db, runtime } = setupIntegrationTest();

  it('cosineDistance computes distance for identical vectors', async () => {
    const row = await runtime()
      .execute(
        db()
          .public.posts.select('id')
          .select('distance', (f, fns) => fns.cosineDistance(f.embedding, [1, 0, 0]))
          .where((f, fns) => fns.eq(f.id, 1))
          .build(),
      )
      .firstOrThrow();
    // template: self <=> arg0, identical vectors → distance = 0
    expect(row.distance).toBeCloseTo(0, 5);
  });

  it('cosineDistance filters in WHERE', async () => {
    // post 1 has embedding [1,0,0] → distance to [1,0,0] is 0.0
    // post 3 has embedding [0,0,1] → distance to [1,0,0] is ~1 (orthogonal)
    const rows = await runtime().execute(
      db()
        .public.posts.select('id')
        .where((f, fns) => fns.lt(fns.cosineDistance(f.embedding, [1, 0, 0]), 0.5))
        .build(),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.id === 1)).toBe(true);
  });

  it('cosineSimilarity computes similarity for identical vectors', async () => {
    const row = await runtime()
      .execute(
        db()
          .public.posts.select('id')
          .select('similarity', (f, fns) => fns.cosineSimilarity(f.embedding, [1, 0, 0]))
          .where((f, fns) => fns.eq(f.id, 1))
          .build(),
      )
      .firstOrThrow();
    // template: 1 - (self <=> arg0), identical vectors → 1 - 0 = 1
    expect(row.similarity).toBeCloseTo(1, 5);
  });

  it('cosineSimilarity filters in WHERE', async () => {
    // post 1 has embedding [1,0,0] → similarity to [1,0,0] is 1.0
    // post 3 has embedding [0,0,1] → similarity to [1,0,0] is ~0 (orthogonal)
    const rows = await runtime().execute(
      db()
        .public.posts.select('id')
        .where((f, fns) => fns.gt(fns.cosineSimilarity(f.embedding, [1, 0, 0]), 0.5))
        .build(),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.id === 1)).toBe(true);
  });
});
