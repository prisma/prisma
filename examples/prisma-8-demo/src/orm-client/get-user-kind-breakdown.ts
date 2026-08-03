import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import type { DefaultModelRow } from '@prisma/orm-postgres/orm-client';
import type { Contract } from '../prisma/contract.d';
import { createOrmClient } from './client';

type UserKind = DefaultModelRow<Contract, 'User'>['kind'];

export async function ormClientGetUserKindBreakdown(
  minUsers: number,
  runtime: Runtime,
): Promise<Array<{ kind: UserKind; totalUsers: number }>> {
  const db = createOrmClient(runtime);
  const grouped = await db.User.groupBy('kind')
    .having((having) => having.count().gte(minUsers))
    .aggregate((aggregate) => ({
      totalUsers: aggregate.count(),
    }));

  return [...grouped].sort((left, right) => left.kind.localeCompare(right.kind));
}
