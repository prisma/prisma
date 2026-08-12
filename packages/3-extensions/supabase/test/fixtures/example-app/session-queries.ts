import type { SupabaseInternalDb } from '../../../src/exports/runtime';

type AalLevel = SupabaseInternalDb['nativeEnums']['auth']['AalLevel']['Value'];

export async function readSessionAal(db: SupabaseInternalDb, sessionId: string) {
  const rows = await db
    .execute(
      db.sql.auth.sessions
        .select('id', 'aal')
        .where((f, fns) => fns.eq(f.id, sessionId))
        .build(),
    )
    .toArray();
  return rows[0];
}

export function findSessionsByAal(db: SupabaseInternalDb, aal: AalLevel) {
  return db
    .execute(
      db.sql.auth.sessions
        .select('id', 'aal')
        .where((f, fns) => fns.eq(f.aal, aal))
        .build(),
    )
    .toArray();
}
