import type { RoleBoundDb } from '@prisma/orm-extension-supabase/runtime';
import type { Contract } from './contract';

export async function insertAndReadProfile(
  db: RoleBoundDb<Contract>,
  username: string,
  userId: string,
) {
  return db.execute(
    db.sql.public.profile
      .insert([{ username, userId }])
      .returning('id', 'username', 'userId')
      .build(),
  );
}
