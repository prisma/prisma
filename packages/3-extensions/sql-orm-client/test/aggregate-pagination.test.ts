import {
  AggregateExpr,
  BinaryExpr,
  ColumnRef,
  DerivedTableSource,
  LiteralExpr,
  OrderByItem,
  ProjectionItem,
} from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { bindWhereExpr } from '../src/where-binding';
import { baseContract, createCollectionFor } from './collection-fixtures';
import { isSelectAst, type MockRuntime } from './helpers';

function selectAstOf(runtime: MockRuntime) {
  const ast = runtime.executions[0]?.plan.ast;
  if (!isSelectAst(ast)) {
    throw new Error('Expected the aggregate execution plan to be a select SQL query plan');
  }
  return ast;
}

function expectDerivedTableSource(source: unknown): asserts source is DerivedTableSource {
  expect(source).toBeInstanceOf(DerivedTableSource);
}

const numericField = 'views' as never;

// Pagination composes through to the aggregate scope on a nested scalar
// refine — `include('posts', (p) => p.skip(5).take(10).count())` aggregates
// over a derived table carrying the LIMIT/OFFSET. The root-level `aggregate()`
// terminal now does the same: `take`/`skip` wrap the source in a derived
// table aliased back to `tableName` (the same trick the plain-select path
// uses for `distinct(cols)`) so the outer aggregate reduces over exactly
// the rows the chain describes. `groupBy()` still forwards only
// `baseFilters`, silently dropping pagination — that terminal is the next
// slice's, so its case below is still `it.fails`.
describe('aggregate pagination', () => {
  it('aggregate() wraps take()/skip() in a scoped derived table', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ totalViews: 500 }]]);

    await collection
      .skip(5)
      .take(10)
      .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

    const ast = selectAstOf(runtime);
    expect(ast.limit).toBeUndefined();
    expect(ast.offset).toBeUndefined();
    expectDerivedTableSource(ast.from);
    expect(ast.from.alias).toBe('posts');
    expect(ast.projection).toEqual([
      ProjectionItem.of('totalViews', AggregateExpr.sum(ColumnRef.of('posts', 'views')), {
        codecId: 'pg/int8number@1',
      }),
    ]);

    const innerSelect = ast.from.query;
    expect(innerSelect.limit).toBe(10);
    expect(innerSelect.offset).toBe(5);
    expect(innerSelect.projection).toEqual([
      ProjectionItem.of('views', ColumnRef.of('posts', 'views')),
    ]);
  });

  it('orderBy() carries into the wrapped inner select, not the outer one', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ totalViews: 500 }]]);

    await collection
      .orderBy((post) => post.views.desc())
      .skip(5)
      .take(10)
      .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

    const ast = selectAstOf(runtime);
    expect(ast.orderBy).toBeUndefined();
    expectDerivedTableSource(ast.from);
    expect(ast.from.query.orderBy).toEqual([OrderByItem.desc(ColumnRef.of('posts', 'views'))]);
  });

  it('wraps a multi-selector spec into one inner column per distinct selector.column, no stray __row', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ total: 3, sumViews: 500, avgViews: 166.67 }]]);

    await collection
      .skip(5)
      .take(10)
      .aggregate((aggregate) => ({
        total: aggregate.count(),
        sumViews: aggregate.sum(numericField),
        avgViews: aggregate.avg(numericField),
      }));

    const ast = selectAstOf(runtime);
    expectDerivedTableSource(ast.from);
    expect(ast.from.query.projection).toEqual([
      ProjectionItem.of('views', ColumnRef.of('posts', 'views')),
    ]);
  });

  it('aggregate() compiles a different plan with pagination', async () => {
    const unpaginated = createCollectionFor('Post');
    unpaginated.runtime.setNextResults([[{ total: 3 }]]);
    await unpaginated.collection.aggregate((aggregate) => ({ total: aggregate.count() }));

    const paginated = createCollectionFor('Post');
    paginated.runtime.setNextResults([[{ total: 3 }]]);
    await paginated.collection
      .skip(5)
      .take(10)
      .aggregate((aggregate) => ({ total: aggregate.count() }));

    expect(selectAstOf(paginated.runtime)).not.toEqual(selectAstOf(unpaginated.runtime));
  });

  it.fails('groupBy().aggregate() applies take()/skip() to the compiled plan', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ user_id: 1, totalViews: 500 }]]);

    await collection
      .skip(5)
      .take(10)
      .groupBy('userId')
      .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

    const ast = selectAstOf(runtime);
    expect(ast.limit).toBe(10);
    expect(ast.offset).toBe(5);
  });

  it('skip() without take() emits OFFSET with no LIMIT', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ totalViews: 500 }]]);

    await collection
      .skip(5)
      .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

    const ast = selectAstOf(runtime);
    expectDerivedTableSource(ast.from);
    const innerSelect = ast.from.query;
    expect(innerSelect.limit).toBeUndefined();
    expect(innerSelect.offset).toBe(5);
  });

  it('cursor on an unpaginated aggregate reaches WHERE without a derived table', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ totalViews: 500 }]]);

    await collection
      .orderBy((post) => post.views.asc())
      .cursor({ views: 100 })
      .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

    const ast = selectAstOf(runtime);
    expect(ast.from).not.toBeInstanceOf(DerivedTableSource);
    expect(ast.limit).toBeUndefined();
    expect(ast.offset).toBeUndefined();
    expect(ast.where).toEqual(
      bindWhereExpr(
        baseContract,
        BinaryExpr.gt(ColumnRef.of('posts', 'views'), LiteralExpr.of(100)),
      ),
    );
  });

  it('no ParamRef instance crosses the derived-table boundary twice', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ totalViews: 500 }]]);

    await collection
      .where((post) => post.views.gte(100))
      .skip(5)
      .take(10)
      .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

    const execution = runtime.executions[0];
    if (execution === undefined) {
      throw new Error('Expected the aggregate chain to run one execution');
    }
    const rawParamRefs = execution.plan.ast.collectParamRefs();
    expect(rawParamRefs).toHaveLength(new Set(rawParamRefs).size);
  });

  it('every selector lacking a column wraps to an inner projection of exactly __row', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ total: 3 }]]);

    await collection.take(10).aggregate((aggregate) => ({ total: aggregate.count() }));

    const ast = selectAstOf(runtime);
    expectDerivedTableSource(ast.from);
    expect(ast.from.query.projection).toEqual([ProjectionItem.of('__row', LiteralExpr.of(1))]);
  });

  describe('distinct() / distinctOn()', () => {
    it('distinct() alone wraps the source in a ROW_NUMBER dedup', async () => {
      const { collection, runtime } = createCollectionFor('Post');
      runtime.setNextResults([[{ totalViews: 500 }]]);

      await collection
        .distinct('title')
        .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

      const ast = selectAstOf(runtime);
      expectDerivedTableSource(ast.from);
      expect(ast.from.alias).toBe('posts');

      const scopedSelect = ast.from.query;
      expect(scopedSelect.orderBy).toBeUndefined();
      expectDerivedTableSource(scopedSelect.from);
      expect(scopedSelect.from.alias).toBe('posts');
    });

    // Postgres requires DISTINCT ON expressions to match the leading ORDER BY
    // expressions (`orderBy((p) => p.title.asc())` leads with the same
    // `title` column `distinctOn('title')` names, with `views` as a
    // tiebreaker) — mirrors the valid usage documented at
    // `collection.ts:920-924`. A chain whose orderBy doesn't lead with the
    // distinctOn columns is a plan the database rejects, not one this test
    // should assert.
    it('distinctOn() lowers to native DISTINCT ON with orderBy applied on the same select', async () => {
      const { collection, runtime } = createCollectionFor('Post');
      runtime.setNextResults([[{ totalViews: 500 }]]);

      await collection
        .orderBy([(post) => post.title.asc(), (post) => post.views.desc()])
        .distinctOn('title')
        .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

      const ast = selectAstOf(runtime);
      expectDerivedTableSource(ast.from);
      const scopedSelect = ast.from.query;
      expect(scopedSelect.from).not.toBeInstanceOf(DerivedTableSource);
      expect(scopedSelect.distinctOn).toEqual([ColumnRef.of('posts', 'title')]);
      expect(scopedSelect.orderBy).toEqual([
        OrderByItem.asc(ColumnRef.of('posts', 'title')),
        OrderByItem.desc(ColumnRef.of('posts', 'views')),
      ]);
    });

    // Discriminating case: `take(2)` must slice the ordered, deduped rows
    // — the top 2 by views — not an arbitrarily-ordered set. The ROW_NUMBER
    // wrap is aliased back to `posts`, so `orderBy` needs no rewriting to
    // resolve through it: an implementation that dropped `orderBy` here
    // (rather than reapplying it through a hidden column, which the old
    // `__scoped`/`__scoped_distinct` two-alias scheme needed and this one
    // doesn't) would leave `scopedSelect.orderBy` undefined, failing the
    // assertion below.
    it('orderBy resolves directly through the ranked-and-scoped alias, no reapplication needed', async () => {
      const { collection, runtime } = createCollectionFor('Post');
      runtime.setNextResults([[{ totalViews: 500 }]]);

      await collection
        .distinct('title')
        .orderBy((post) => post.views.desc())
        .take(2)
        .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

      const ast = selectAstOf(runtime);
      expectDerivedTableSource(ast.from);
      expect(ast.from.alias).toBe('posts');

      const scopedSelect = ast.from.query;
      expect(scopedSelect.limit).toBe(2);
      expectDerivedTableSource(scopedSelect.from);
      expect(scopedSelect.from.alias).toBe('posts');
      expect(scopedSelect.orderBy).toEqual([OrderByItem.desc(ColumnRef.of('posts', 'views'))]);
    });

    it('distinct() combined with skip() (no take()) emits OFFSET with no LIMIT on the deduped select', async () => {
      const { collection, runtime } = createCollectionFor('Post');
      runtime.setNextResults([[{ totalViews: 500 }]]);

      await collection
        .distinct('title')
        .skip(3)
        .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

      const ast = selectAstOf(runtime);
      expectDerivedTableSource(ast.from);
      const scopedSelect = ast.from.query;
      expect(scopedSelect.limit).toBeUndefined();
      expect(scopedSelect.offset).toBe(3);
      expectDerivedTableSource(scopedSelect.from);
      expect(scopedSelect.from.alias).toBe('posts');
    });

    it('distinct() combined with cursor() carries the cursor boundary onto the pre-dedup select', async () => {
      const { collection, runtime } = createCollectionFor('Post');
      runtime.setNextResults([[{ totalViews: 500 }]]);

      await collection
        .orderBy((post) => post.views.asc())
        .cursor({ views: 100 })
        .distinct('title')
        .aggregate((aggregate) => ({ totalViews: aggregate.sum(numericField) }));

      const ast = selectAstOf(runtime);
      expectDerivedTableSource(ast.from);
      const scopedSelect = ast.from.query;
      expectDerivedTableSource(scopedSelect.from);
      expect(scopedSelect.from.alias).toBe('posts');

      const dedupBase = scopedSelect.from.query;
      expect(dedupBase.where).toEqual(
        bindWhereExpr(
          baseContract,
          BinaryExpr.gt(ColumnRef.of('posts', 'views'), LiteralExpr.of(100)),
        ),
      );
    });
  });
});
