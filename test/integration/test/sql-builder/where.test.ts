import { describe, expect, it } from 'vitest';
import { setupIntegrationTest, timeouts } from './setup';

describe('integration: WHERE', { timeout: timeouts.databaseOperation }, () => {
  const { db, runtime } = setupIntegrationTest();

  it('eq filters to matching row', async () => {
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

  it('gt filters rows', async () => {
    const rows = await runtime().execute(
      db()
        .public.users.select('id')
        .where((f, fns) => fns.gt(f.id, 2))
        .build(),
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.id > 2)).toBe(true);
  });

  it('lt filters rows', async () => {
    const rows = await runtime().execute(
      db()
        .public.users.select('id')
        .where((f, fns) => fns.lt(f.id, 3))
        .build(),
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.id < 3)).toBe(true);
  });

  it('multiple where calls AND together', async () => {
    const rows = await runtime().execute(
      db()
        .public.users.select('id')
        .where((f, fns) => fns.gt(f.id, 1))
        .where((f, fns) => fns.lt(f.id, 4))
        .build(),
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual([2, 3]);
  });

  it('eq(col, null) produces IS NULL', async () => {
    const rows = await runtime().execute(
      db()
        .public.users.select('id', 'name')
        .where((f, fns) => fns.eq(f.invited_by_id, null))
        .build(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Alice');
  });

  it('ne(col, null) produces IS NOT NULL', async () => {
    const rows = await runtime().execute(
      db()
        .public.users.select('id', 'name')
        .where((f, fns) => fns.ne(f.invited_by_id, null))
        .orderBy('id')
        .build(),
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name)).toEqual(['Bob', 'Charlie', 'Diana']);
  });

  it('or within a single where', async () => {
    const rows = await runtime().execute(
      db()
        .public.users.select('id')
        .where((f, fns) => fns.or(fns.eq(f.id, 1), fns.eq(f.id, 4)))
        .orderBy('id')
        .build(),
    );
    expect(rows.map((r) => r.id)).toEqual([1, 4]);
  });
});
