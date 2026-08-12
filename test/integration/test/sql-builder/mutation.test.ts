import { describe, expect, it } from 'vitest';
import { setupIntegrationTest, timeouts } from './setup';

describe('integration: mutations', { timeout: timeouts.databaseOperation }, () => {
  const { db, runtime } = setupIntegrationTest();

  it('INSERT returns inserted row via returning', async () => {
    const row = await runtime()
      .execute(
        db()
          .public.users.insert([{ id: 100, name: 'NewUser', email: 'new@test.com' }])
          .returning('id', 'name')
          .build(),
      )
      .firstOrThrow();
    expect(row.id).toBe(100);
    expect(row.name).toBe('NewUser');

    const allRows = await runtime().execute(db().public.users.select('id', 'name').build());
    expect(allRows.find((r) => r.id === 100)).toEqual({ id: 100, name: 'NewUser' });
  });

  it('UPDATE with WHERE returns updated row', async () => {
    const row = await runtime()
      .execute(
        db()
          .public.users.update({ name: 'UpdatedAlice' })
          .where((f, fns) => fns.eq(f.id, 1))
          .returning('id', 'name')
          .build(),
      )
      .firstOrThrow();
    expect(row.name).toBe('UpdatedAlice');

    const verified = await runtime()
      .execute(
        db()
          .public.users.select('id', 'name')
          .where((f, fns) => fns.eq(f.id, 1))
          .build(),
      )
      .firstOrThrow();
    expect(verified.name).toBe('UpdatedAlice');
  });

  it('DELETE with WHERE returns deleted row', async () => {
    const row = await runtime()
      .execute(
        db()
          .public.users.delete()
          .where((f, fns) => fns.eq(f.id, 4))
          .returning('id', 'name')
          .build(),
      )
      .firstOrThrow();
    expect(row.id).toBe(4);

    const deleted = await runtime()
      .execute(
        db()
          .public.users.select('id')
          .where((f, fns) => fns.eq(f.id, 4))
          .build(),
      )
      .first();
    expect(deleted).toBeNull();
  });

  it('UPDATE accumulates multiple where() clauses with AND', async () => {
    await runtime().execute(
      db()
        .public.users.insert([{ id: 300, name: 'Multi', email: 'multi@test.com' }])
        .build(),
    );

    const row = await runtime()
      .execute(
        db()
          .public.users.update({ name: 'MultiUpdated' })
          .where((f, fns) => fns.eq(f.name, 'Multi'))
          .where((f, fns) => fns.eq(f.email, 'multi@test.com'))
          .returning('id', 'name')
          .build(),
      )
      .firstOrThrow();
    expect(row.name).toBe('MultiUpdated');
  });

  it('multi-row INSERT with returning yields one result per row', async () => {
    const rows = await runtime().execute(
      db()
        .public.users.insert([
          { id: 401, name: 'First', email: 'first@test.com' },
          { id: 402, name: 'Second', email: 'second@test.com' },
        ])
        .returning('id')
        .build(),
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.id).sort()).toEqual([401, 402]);
  });

  it('INSERT without returning executes silently', async () => {
    const row = await runtime()
      .execute(
        db()
          .public.users.insert([{ id: 200, name: 'Silent', email: 'silent@test.com' }])
          .build(),
      )
      .first();
    expect(row).toBeNull();

    const inserted = await runtime()
      .execute(
        db()
          .public.users.select('id', 'name')
          .where((f, fns) => fns.eq(f.id, 200))
          .build(),
      )
      .firstOrThrow();
    expect(inserted).toEqual({ id: 200, name: 'Silent' });
  });
});
