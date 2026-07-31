import { acc } from '@prisma/orm-mongo/query-builder';
import type { Db } from './db';

type Runtime = Awaited<ReturnType<Db['runtime']>>;

/**
 * Authors ranked by post count, plus the most recent post date and an embedded
 * `author` document resolved via `$lookup`.
 *
 * Demonstrates the Mongo pipeline DSL terminating in `.build()`, executed via
 * the runtime returned from the canonical `mongo()` facade.
 */
export async function getAuthorLeaderboard(db: Db, runtime: Runtime) {
  const leaderboard = db.query
    .from('posts')
    .group((f) => ({
      _id: f.authorId,
      postCount: acc.count(),
      latestPost: acc.max(f.createdAt),
    }))
    .sort({ postCount: -1 })
    .lookup((from) =>
      from('users')
        .on((local, foreign) => ({
          local: local._id,
          foreign: foreign._id,
        }))
        .as('author'),
    )
    .build();

  return runtime.execute(leaderboard);
}
