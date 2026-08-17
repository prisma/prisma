import {
  AggregateExpr,
  BinaryExpr,
  ColumnRef,
  DerivedTableSource,
  LiteralExpr,
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
// terminal now does the same: `take`/`skip` wrap the source in a
// `${tableName}__scoped` derived table so the outer aggregate reduces over
// exactly the rows the chain describes. `groupBy()` still forwards only
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
    expect(ast.from.alias).toBe('posts__scoped');
    expect(ast.projection).toEqual([
      ProjectionItem.of('totalViews', AggregateExpr.sum(ColumnRef.of('posts__scoped', 'views')), {
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
    const uniqueParamRefs = new Set(rawParamRefs);
    expect(rawParamRefs).toHaveLength(uniqueParamRefs.size);
    expect(execution.plan.params).toHaveLength(uniqueParamRefs.size);
  });
});
