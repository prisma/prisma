import type { DemoClient } from '../prisma/db';

export async function ormClientLockUserPosts(userId: string, client: DemoClient) {
  return client.transaction(async (tx) =>
    tx.orm.public.Post.forUser(userId).newestFirst().select('id', 'title').forUpdate().all(),
  );
}
