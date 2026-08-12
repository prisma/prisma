import { describe, expect, it } from 'vitest';
import { setupIntegrationTest, timeouts } from './setup';

describe('integration: execution methods', { timeout: timeouts.databaseOperation }, () => {
  const { db, runtime } = setupIntegrationTest();

  it('executes plan and returns rows', async () => {
    const row = await runtime()
      .execute(
        db()
          .public.users.select('id', 'name')
          .where((f, fns) => fns.eq(f.id, 1))
          .build(),
      )
      .firstOrThrow();
    expect(row.id).toBe(1);
    expect(row.name).toBe('Alice');
  });

  it('returns empty array for no matches', async () => {
    const row = await runtime()
      .execute(
        db()
          .public.users.select('id')
          .where((f, fns) => fns.eq(f.id, 9999))
          .build(),
      )
      .first();
    expect(row).toBeNull();
  });

  it('returns matching row', async () => {
    const row = await runtime()
      .execute(
        db()
          .public.users.select('id', 'name')
          .where((f, fns) => fns.eq(f.id, 2))
          .build(),
      )
      .firstOrThrow();
    expect(row.id).toBe(2);
    expect(row.name).toBe('Bob');
  });
});
