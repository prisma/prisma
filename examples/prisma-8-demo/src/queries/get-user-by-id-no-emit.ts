import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { sql } from '../prisma-no-emit/context';
import { firstOrNull } from '../result-utils';

export async function getUserById(userId: string, runtime: Runtime) {
  return firstOrNull(
    runtime.execute(
      sql.user
        .select('id', 'email', 'createdAt')
        .where((f, fns) => fns.eq(f.id, userId))
        .limit(1)
        .build(),
    ),
  );
}
