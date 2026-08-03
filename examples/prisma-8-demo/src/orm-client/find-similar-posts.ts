import type { Runtime } from '@prisma/orm-postgres/family-runtime';
import type { ModelAccessor } from '@prisma/orm-postgres/orm-client';
import type { Char } from '@prisma/orm-postgres/target/codec-types';
import type { Contract } from '../prisma/contract';
import { createOrmClient } from './client';

export async function ormClientFindSimilarPosts(postId: string, limit: number, runtime: Runtime) {
  const db = createOrmClient(runtime);

  const toPost = await db.Post.select('embedding').first({ id: postId as Char<36> });
  if (!toPost) {
    throw new Error(`Post not found: ${postId}`);
  }

  const { embedding } = toPost;
  if (!embedding) {
    return [];
  }

  const cosineDistanceFrom = (fromPost: ModelAccessor<Contract, 'Post'>) =>
    fromPost.embedding.cosineDistance(embedding);

  return db.Post.where((p) => p.id.neq(postId as Char<36>))
    .where((p) => cosineDistanceFrom(p).lt(1))
    .orderBy((p) => cosineDistanceFrom(p).asc())
    .select('id', 'title', 'userId')
    .include('user', (user) => user.select('id', 'email'))
    .take(limit)
    .all();
}
