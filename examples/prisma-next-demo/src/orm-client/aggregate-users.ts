import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { createOrmClient } from './client';

export async function ormClientAggregateUsers(runtime: Runtime) {
  const db = createOrmClient(runtime);
  const totalUsers = await db.User.aggregate((aggregate) => ({
    totalUsers: aggregate.count(),
  }));
  const adminUsers = await db.User.where({ kind: 'admin' }).aggregate((aggregate) => ({
    adminUsers: aggregate.count(),
  }));

  return {
    ...totalUsers,
    ...adminUsers,
  };
}
