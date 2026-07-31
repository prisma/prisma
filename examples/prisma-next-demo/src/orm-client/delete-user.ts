import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import type { DefaultModelRow } from '@prisma/orm-postgres/orm-client';
import type { Contract } from '../prisma/contract.d';
import { createOrmClient } from './client';

type UserId = DefaultModelRow<Contract, 'User'>['id'];

export async function ormClientDeleteUser(id: string, runtime: Runtime) {
  const db = createOrmClient(runtime);
  return db.User.where({ id: toUserId(id) }).delete();
}

function toUserId(value: string): UserId {
  return value as UserId;
}
