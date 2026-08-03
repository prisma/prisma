import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { orm } from '@prisma/orm-postgres/orm-client';
import type { ExecutionContext } from '@prisma/orm-postgres/relational-core/query-lane-context';
import type { Contract } from '../prisma/contract.d';
import { db } from '../prisma/db';
import { PostCollection, TagCollection, TaskCollection, UserCollection } from './collections';

const context = db.context as ExecutionContext<Contract>;

export function createOrmClient(runtime: Runtime) {
  return orm({
    runtime,
    context,
    collections: {
      User: UserCollection,
      Post: PostCollection,
      Tag: TagCollection,
      Task: TaskCollection,
    },
  }).public;
}
