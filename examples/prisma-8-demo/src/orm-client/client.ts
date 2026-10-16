import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { orm } from '@prisma/orm-postgres/orm-client';
import { db } from '../prisma/db';
import { PostCollection, TagCollection, TaskCollection, UserCollection } from './collections';

const context = db.context;

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
