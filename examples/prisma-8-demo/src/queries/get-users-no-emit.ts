import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { sql } from '../prisma-no-emit/context';

export async function getUsers(runtime: Runtime, limit = 10) {
  return runtime.query(sql.user.select('id', 'email', 'createdAt').limit(limit).build());
}
