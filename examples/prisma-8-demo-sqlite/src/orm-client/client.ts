import { UNBOUND_NAMESPACE_ID } from '@prisma/orm-sqlite/components/ir';
import { orm } from '@prisma/orm-sqlite/orm-client';
import type { ExecutionContext } from '@prisma/orm-sqlite/relational-core/query-lane-context';
import type { SqliteRuntime } from '@prisma/orm-sqlite/runtime';
import type { Contract } from '../prisma/contract.d';
import { db } from '../prisma/db';

const context = db.context as ExecutionContext<Contract>;

export function createOrmClient(runtime: SqliteRuntime) {
  return orm({ runtime, context })[UNBOUND_NAMESPACE_ID];
}
