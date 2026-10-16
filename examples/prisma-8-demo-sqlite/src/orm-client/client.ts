import { UNBOUND_NAMESPACE_ID } from '@prisma/orm-sqlite/components/ir';
import { orm } from '@prisma/orm-sqlite/orm-client';
import type { SqliteRuntime } from '@prisma/orm-sqlite/runtime';
import { db } from '../prisma/db';

const context = db.context;

export function createOrmClient(runtime: SqliteRuntime) {
  return orm({ runtime, context })[UNBOUND_NAMESPACE_ID];
}
