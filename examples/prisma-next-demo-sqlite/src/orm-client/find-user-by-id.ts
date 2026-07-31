import type { DefaultModelRow } from '@prisma/orm-sqlite/orm-client';
import type { SqliteRuntime } from '@prisma/orm-sqlite/runtime';
import type { Contract } from '../prisma/contract.d';
import { createOrmClient } from './client';

type UserId = DefaultModelRow<Contract, 'User'>['id'];

export async function ormClientFindUserById(id: string, runtime: SqliteRuntime) {
  const db = createOrmClient(runtime);
  return db.User.first({ id: toUserId(id) });
}

function toUserId(value: string): UserId {
  return value as UserId;
}
