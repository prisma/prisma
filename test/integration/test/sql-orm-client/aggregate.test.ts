import { describe, expect, it } from 'vitest';
import {
  createPostsCollection,
  createUsersCollection,
  timeouts,
  withCollectionRuntime,
} from './integration-helpers';
import { seedPosts, seedUsers } from './runtime-helpers';

describe('integration/aggregate', () => {
  it(
    'aggregate() computes count() with where() in one query',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Alice', email: 'alice2@example.com' },
          { id: 3, name: 'Bob', email: 'bob@example.com' },
        ]);

        runtime.resetExecutions();
        const stats = await users.where({ name: 'Alice' }).aggregate((aggregate) => ({
          count: aggregate.count(),
        }));

        expect(stats).toEqual({ count: 2 });
        expect(runtime.executions).toHaveLength(1);
        expect(runtime.executions[0]?.sql.toLowerCase()).toContain('count(*)');
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'aggregate() supports multiple numeric aggregations with filters',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const posts = createPostsCollection(runtime);

        await seedPosts(runtime, [
          { id: 10, title: 'Low', userId: 1, views: 10 },
          { id: 11, title: 'Mid', userId: 1, views: 20 },
          { id: 12, title: 'High', userId: 2, views: 30 },
        ]);

        const numericField = 'views' as never;
        const stats = await posts
          .where((post) => post.views.gte(20))
          .aggregate((aggregate) => ({
            count: aggregate.count(),
            total: aggregate.sum(numericField),
            avg: aggregate.avg(numericField),
            min: aggregate.min(numericField),
            max: aggregate.max(numericField),
          }));

        // Each value is the target's declared result codec speaking: the bare
        // `count`, `sum` and `avg` answer as JS numbers, and `min`/`max` keep
        // the column's own int4.
        expect(stats).toEqual({
          count: 2,
          total: 50,
          avg: 25,
          min: 20,
          max: 30,
        });
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'aggregate() returns null for sum/avg/min/max on empty result sets',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const posts = createPostsCollection(runtime);

        await seedPosts(runtime, [{ id: 10, title: 'Only', userId: 1, views: 10 }]);

        const numericField = 'views' as never;
        const stats = await posts
          .where((post) => post.views.gt(999))
          .aggregate((aggregate) => ({
            count: aggregate.count(),
            total: aggregate.sum(numericField),
            avg: aggregate.avg(numericField),
            min: aggregate.min(numericField),
            max: aggregate.max(numericField),
          }));

        expect(stats).toEqual({
          count: 0,
          total: null,
          avg: null,
          min: null,
          max: null,
        });
      });
    },
    timeouts.spinUpPpgDev,
  );

  // The value-level proof that an aggregate past 2^53 throws rather than
  // rounds needs a column whose total exceeds a double's integers; this
  // fixture's widest numeric column is int4, so the boundary itself is pinned
  // against the integer-representation fixture instead.
  it(
    'reads a widened sum and an include count as the numbers they now are',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const posts = createPostsCollection(runtime);
        const users = createUsersCollection(runtime);

        await seedUsers(runtime, [{ id: 1, name: 'Alice', email: 'alice@example.com' }]);
        await seedPosts(runtime, [
          { id: 10, title: 'a', userId: 1, views: 2000000000 },
          { id: 11, title: 'b', userId: 1, views: 2000000000 },
        ]);

        const numericField = 'views' as never;
        const stats = await posts.aggregate((aggregate) => ({
          count: aggregate.count(),
          total: aggregate.sum(numericField),
        }));

        // The sum exceeds int4, and the number the bare operation answers with
        // carries it exactly — the guard is what makes that safe to rely on.
        expect(stats).toEqual({ count: 2, total: 4000000000 });

        const rows = await users
          .select('id')
          .include('posts', (related) => related.count())
          .all();

        // An include count reads through the same codec: a JSON number again,
        // and safely, since the guard runs after the parse.
        expect(rows).toEqual([{ id: 1, posts: 2 }]);
      });
    },
    timeouts.spinUpPpgDev,
  );
});
