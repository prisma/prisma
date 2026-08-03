import { db } from '../prisma/db';

export const MAX_POSTS_PER_USER = 5;

export class QuotaExceededError extends Error {
  constructor(
    readonly userId: string,
    readonly existingCount: number,
    readonly attempted: number,
    readonly limit: number,
  ) {
    super(
      `User ${userId} already has ${existingCount} post(s); adding ${attempted} would exceed the limit of ${limit}`,
    );
    this.name = 'QuotaExceededError';
  }
}

export interface AddPostsWithinQuotaInput {
  readonly userId: string;
  readonly titles: readonly string[];
}

export async function addPostsWithinQuota(input: AddPostsWithinQuotaInput) {
  return db.transaction(async (tx) => {
    // Count existing posts with the SQL builder — the native aggregate surface.
    const countRows = await tx.execute(
      tx.sql.post
        .select('postCount', (_f, fns) => fns.count())
        .where((f, fns) => fns.eq(f.userId, input.userId))
        .build(),
    );
    const existingCount = Number(countRows[0]?.postCount ?? 0);

    // The count and the inserts must be one atomic unit: two concurrent callers
    // could each pass a standalone check and jointly exceed the quota (TOCTOU).
    if (existingCount + input.titles.length > MAX_POSTS_PER_USER) {
      throw new QuotaExceededError(
        input.userId,
        existingCount,
        input.titles.length,
        MAX_POSTS_PER_USER,
      );
    }

    // Create each post with the ORM client — returns fully-typed rows.
    const posts = await Promise.all(
      input.titles.map((title) =>
        tx.orm.Post.select('id', 'title', 'userId').create({
          title,
          userId: input.userId,
        }),
      ),
    );

    return { existingCount, posts };
  });
}
