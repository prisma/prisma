import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { websearchToTsquery } from '@prisma/orm-postgres/target/full-text';
import { createOrmClient } from './client';

/**
 * Full-text search over a post's title and body, best match first.
 *
 * `using.post_search` is the method the Postgres package contributes for the `post_search` index. It searches the document the index was built over, the title with weight A and the body with weight B, and orders by relevance, so a match in the title ranks above a match in the body, and Postgres uses the index.
 */
export async function ormClientSearchPosts(query: string, limit: number, runtime: Runtime) {
  const db = createOrmClient(runtime);
  return db.Post.select('id', 'title', 'body')
    .using.post_search(websearchToTsquery(query))
    .orderBy((p) => p.id.asc())
    .limit(limit)
    .all();
}
