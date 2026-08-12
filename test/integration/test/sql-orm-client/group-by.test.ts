import { AggregateExpr, BinaryExpr, LiteralExpr } from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { isSelectAst } from './helpers';
import { createPostsCollection, timeouts, withCollectionRuntime } from './integration-helpers';
import { seedPosts } from './runtime-helpers';

describe('integration/groupBy', () => {
  it(
    'groupBy().aggregate() returns grouped counts',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const posts = createPostsCollection(runtime);

        await seedPosts(runtime, [
          { id: 10, title: 'A', userId: 1, views: 10 },
          { id: 11, title: 'B', userId: 1, views: 20 },
          { id: 12, title: 'C', userId: 2, views: 30 },
        ]);

        runtime.resetExecutions();
        const grouped = await posts.groupBy('userId').aggregate((aggregate) => ({
          count: aggregate.count(),
        }));

        const sorted = [...grouped].sort(
          (left, right) => Number(left.userId) - Number(right.userId),
        );
        expect(sorted).toEqual([
          { userId: 1, count: 2 },
          { userId: 2, count: 1 },
        ]);
        expect(runtime.executions).toHaveLength(1);
        expect(runtime.executions[0]?.sql.toLowerCase()).toContain('group by');
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'having() filters grouped rows by aggregate predicates',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const posts = createPostsCollection(runtime);

        await seedPosts(runtime, [
          { id: 10, title: 'A', userId: 1, views: 10 },
          { id: 11, title: 'B', userId: 1, views: 20 },
          { id: 12, title: 'C', userId: 2, views: 30 },
        ]);

        runtime.resetExecutions();
        const grouped = await posts
          .groupBy('userId')
          .having((having) => having.count().gt(1))
          .aggregate((aggregate) => ({
            count: aggregate.count(),
          }));

        expect(grouped).toEqual([{ userId: 1, count: 2 }]);
        expect(runtime.executions).toHaveLength(1);
        const ast = runtime.executions[0]?.ast;
        expect(isSelectAst(ast)).toBe(true);
        if (!isSelectAst(ast)) {
          throw new Error('Expected grouped query to emit a select AST plan');
        }
        expect(ast.having).toEqual(BinaryExpr.gt(AggregateExpr.count(), LiteralExpr.of(1)));
      });
    },
    timeouts.spinUpPpgDev,
  );

  it(
    'groupBy() preserves where() filters and supports numeric aggregations',
    async () => {
      await withCollectionRuntime(async (runtime) => {
        const posts = createPostsCollection(runtime);

        await seedPosts(runtime, [
          { id: 10, title: 'A', userId: 1, views: 10 },
          { id: 11, title: 'B', userId: 1, views: 20 },
          { id: 12, title: 'C', userId: 2, views: 30 },
        ]);

        const numericField = 'views' as never;
        const grouped = await posts
          .where((post) => post.views.gte(20))
          .groupBy('userId')
          .aggregate((aggregate) => ({
            totalViews: aggregate.sum(numericField),
            avgViews: aggregate.avg(numericField),
          }));

        const sorted = [...grouped].sort(
          (left, right) => Number(left.userId) - Number(right.userId),
        );
        expect(sorted).toEqual([
          // The bare operations answer in the JS types a caller expects: the
          // sum of integers as a number, the mean as a number too.
          { userId: 1, totalViews: 20, avgViews: 20 },
          { userId: 2, totalViews: 30, avgViews: 30 },
        ]);
      });
    },
    timeouts.spinUpPpgDev,
  );
});
