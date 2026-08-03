import type { DefaultModelRow } from '@prisma/orm-sqlite/orm-client';
import type { SqliteRuntime } from '@prisma/orm-sqlite/runtime';
import type { Contract } from '../prisma/contract.d';
import { createOrmClient } from './client';

type UserRow = DefaultModelRow<Contract, 'User'>;

export interface OrmClientCreateUserInput {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly createdAt: Date | string;
}

export async function ormClientCreateUser(data: OrmClientCreateUserInput, runtime: SqliteRuntime) {
  const db = createOrmClient(runtime);
  return db.User.select('id', 'email').create({
    id: toUserId(data.id),
    email: data.email,
    displayName: data.displayName,
    createdAt: toUserCreatedAt(data.createdAt),
  });
}

function toUserId(value: string): UserRow['id'] {
  return value as UserRow['id'];
}

function toUserCreatedAt(value: Date | string): UserRow['createdAt'] {
  return (value instanceof Date ? value : new Date(value)) as UserRow['createdAt'];
}
