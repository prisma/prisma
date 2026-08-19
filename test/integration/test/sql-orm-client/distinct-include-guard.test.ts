import { describe, expect, it } from 'vitest';
import { createUsersCollection, timeouts, withCollectionRuntime } from './integration-helpers';
import { seedComments, seedPosts, seedUsers } from './runtime-helpers';

describe('integration/distinct + include guard', () => {
  it(
    'distinct() combined with a root-level include is rejected',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);
        await seedUsers(runtime, [{ id: 1, name: 'Alice', email: 'alice@example.com' }]);

        await expect(users.include('posts').distinct().all()).rejects.toThrow(
          "distinct() cannot combine with include('posts')",
        );
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct() combined with a nested include inside a refinement is rejected',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);
        await seedUsers(runtime, [{ id: 1, name: 'Alice', email: 'alice@example.com' }]);

        await expect(
          users.include('posts', (posts) => posts.include('comments').distinct()).all(),
        ).rejects.toThrow("distinct() cannot combine with include('comments')");
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'distinct() without any include still works',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);
        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'shared@example.com' },
          { id: 2, name: 'Bob', email: 'shared@example.com' },
        ]);

        const rows = await users.select('email').distinct().all();
        expect(rows).toEqual([{ email: 'shared@example.com' }]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'distinctOn(...) combined with an include is unaffected by the guard and runs correctly',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);
        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'shared@example.com' },
          { id: 2, name: 'Bob', email: 'shared@example.com' },
        ]);
        await seedPosts(runtime, [
          { id: 10, title: 'A', userId: 1, views: 1 },
          { id: 11, title: 'B', userId: 2, views: 2 },
        ]);

        // distinctOn dedupes only the listed columns (email), not the whole
        // row - so the include's json_agg column rides along harmlessly.
        // Confirmed empirically here, not assumed: this is the property the
        // guard depends on to know distinctOn is safe to leave unguarded.
        const rows = await users
          .orderBy((user) => user.email.asc())
          .distinctOn('email')
          .include('posts')
          .all();

        expect(rows).toEqual([
          {
            id: 1,
            name: 'Alice',
            email: 'shared@example.com',
            invitedById: null,
            address: null,
            posts: [{ id: 10, title: 'A', userId: 1, views: 1, embedding: null }],
          },
        ]);
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'guards a scalar include reducer refinement carrying its own nested include',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);
        await seedUsers(runtime, [{ id: 1, name: 'Alice', email: 'alice@example.com' }]);
        await seedPosts(runtime, [{ id: 10, title: 'A', userId: 1, views: 1 }]);
        await seedComments(runtime, [{ id: 100, body: 'c', postId: 10 }]);

        await expect(
          users
            .include('posts', (posts) =>
              posts.combine({
                rows: posts.include('comments').distinct(),
                count: posts.count(),
              }),
            )
            .all(),
        ).rejects.toThrow("distinct() cannot combine with include('comments')");
      });
    },
    timeouts.spinUpPpgDev,
  );
});
