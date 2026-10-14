import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import { createOrmClient } from './client';

/**
 * The posts nearest to `searchEmbedding` by cosine distance, within `maxDistance`. `using.embedding_nearest` is the method the pgvector package contributes for the `embedding` field.
 */
export async function ormClientSearchPostsByEmbedding(
  searchEmbedding: number[],
  maxDistance: number,
  limit: number,
  runtime: Runtime,
) {
  const db = createOrmClient(runtime);
  return db.Post.using.embedding_nearest(searchEmbedding, maxDistance).limit(limit).all();
}
