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

        expect(stats).toEqual({ count: 2n });
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

        // Each value is the target's declared result codec speaking: `count`
        // and a widened `sum` over int4 are bigints, `avg` is a numeric whose
        // canonical form is a decimal string, and `min`/`max` keep the column's
        // own int4.
        expect(stats).toEqual({
          count: 2n,
          total: 50n,
          avg: '25.0000000000000000',
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
          count: 0n,
          total: null,
          avg: null,
          min: null,
          max: null,
        });
      });
    },
    timeouts.spinUpPpgDev,
  );

  // The value-level proof that an aggregate past 2^53 survives both paths needs
  // a column whose single value exceeds a double's integers; this fixture's
  // widest numeric column is int4. The decimal-string channel is proven above:
  // `avg` returns '25.0000000000000000', a form no number carries.
  it(
    'reads a widened sum as a bigint and a numeric average as its decimal string',
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

        // The sum exceeds int4 and comes back as the int8 the target declares —
        // as a bigint, not a number that happens to fit today.
        expect(stats).toEqual({ count: 2n, total: 4000000000n });

        const [row] = await users.include('posts', (related) => related.count()).all();

        // An include count reads through the same codec: a bigint inside JSON.
        expect(row?.posts).toBe(2n);
      });
    },
    timeouts.spinUpPpgDev,
  );
});
