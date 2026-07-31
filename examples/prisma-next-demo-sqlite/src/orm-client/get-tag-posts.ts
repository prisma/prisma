import type { DefaultModelRow } from '@prisma/orm-sqlite/orm-client';
import type { SqliteRuntime } from '@prisma/orm-sqlite/runtime';
import { castAs } from '@prisma/orm-sqlite/utils/casts';
import type { Contract } from '../prisma/contract.d';
import { createOrmClient } from './client';

type TagId = DefaultModelRow<Contract, 'Tag'>['id'];

/**
 * Many-to-many reverse-direction include example: fetch a tag along with the
 * posts that carry it via the Tag.posts N:M relation — the same PostTag
 * junction as Post.tags, walked from the other side.
 */
export async function ormClientGetTagPosts(tagId: string, runtime: SqliteRuntime) {
  const db = createOrmClient(runtime);
  return db.Tag.include('posts', (post) => post.select('id', 'title').orderBy((p) => p.title.asc()))
    .where({ id: castAs<TagId>(tagId) })
    .first();
}
