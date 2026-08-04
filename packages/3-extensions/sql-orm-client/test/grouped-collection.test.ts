import {
  AggregateExpr,
  type AnyExpression,
  type BinaryExpr,
  CaseExpr,
  CastExpr,
  FunctionCallExpr,
  LiteralExpr,
} from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { createCollectionFor } from './collection-fixtures';
import { isSelectAst } from './helpers';

describe('GroupedCollection', () => {
  it('groupBy().aggregate() maps grouped columns back to model fields', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ user_id: 1, count: '2' }]]);

    const rows = await collection.groupBy('userId').aggregate((aggregate) => ({
      count: aggregate.count(),
    }));

    expect(rows).toEqual([{ userId: 1, count: 2 }]);
  });

  it('having() compiles aggregate predicates into HAVING clauses', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([[{ user_id: 1, totalViews: '50' }]]);

    const numericField = 'views' as never;
    const rows = await collection
      .groupBy('userId')
      .having((having) => having.count().gte(1))
      .aggregate((aggregate) => ({
        totalViews: aggregate.sum(numericField),
      }));

    expect(rows).toEqual([{ userId: 1, totalViews: 50 }]);
    const firstAst = runtime.executions[0]?.plan.ast;
    expect(isSelectAst(firstAst)).toBe(true);
    if (!isSelectAst(firstAst)) {
      throw new Error('Expected first execution plan to be a select SQL query plan');
    }
    expect(firstAst.having?.kind).toBe('binary');
    if (firstAst.having?.kind === 'binary') {
      expect((firstAst.having as BinaryExpr).left).toEqual(AggregateExpr.count());
    }
    const totalViewsProjection = firstAst.projection.find((item) => item.alias === 'totalViews');
    expect(totalViewsProjection?.expr.kind).toBe('aggregate');
    expect((totalViewsProjection!.expr as AggregateExpr).fn).toBe('sum');
  });

  it.each<{ kind: string; expression: AnyExpression }>([
    {
      kind: 'function-call',
      expression: FunctionCallExpr.of('lower', [LiteralExpr.of('value')]),
    },
    {
      kind: 'cast',
      expression: CastExpr.as(LiteralExpr.of('value'), 'text'),
    },
    {
      kind: 'case',
      expression: CaseExpr.of([
        {
          condition: LiteralExpr.of(true),
          value: LiteralExpr.of('value'),
        },
      ]),
    },
  ])('rejects $kind expressions in grouped HAVING', async ({ kind, expression }) => {
    const { collection } = createCollectionFor('Post');

    await expect(
      collection
        .groupBy('userId')
        .having(() => expression)
        .aggregate((aggregate) => ({ count: aggregate.count() })),
    ).rejects.toThrow(`Unsupported grouped having expression kind "${kind}"`);
  });

  it('groupBy().aggregate() validates selector shape and non-empty spec', async () => {
    const { collection } = createCollectionFor('Post');

    await expect(collection.groupBy('userId').aggregate(() => ({}))).rejects.toThrow(
      /requires at least one aggregation selector/,
    );

    await expect(
      collection
        .groupBy('userId')
        .aggregate(() => ({ invalid: { kind: 'unknown', fn: 'count' } as never })),
    ).rejects.toThrow(/selector "invalid" is invalid/);
  });

  it('groupBy().having() supports all metrics and comparison operators', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([
      [{ user_id: 1, total: '20', avg: '10', min: '5', max: '15', count: '2' }],
      [{ user_id: 1, total: '20', avg: '10', min: '5', max: '15', count: '2' }],
      [{ user_id: 1, total: '20', avg: '10', min: '5', max: '15', count: '2' }],
      [{ user_id: 1, total: '20', avg: '10', min: '5', max: '15', count: '2' }],
      [{ user_id: 1, total: '20', avg: '10', min: '5', max: '15', count: '2' }],
      [{ user_id: 1, total: '20', avg: '10', min: '5', max: '15', count: '2' }],
    ]);

    const numericField = 'views' as never;

    await collection
      .groupBy('userId')
      .having((having) => having.sum(numericField).eq(20))
      .aggregate((aggregate) => ({ total: aggregate.sum(numericField) }));
    await collection
      .groupBy('userId')
      .having((having) => having.avg(numericField).neq(99))
      .aggregate((aggregate) => ({ avg: aggregate.avg(numericField) }));
    await collection
      .groupBy('userId')
      .having((having) => having.min(numericField).gt(4))
      .aggregate((aggregate) => ({ min: aggregate.min(numericField) }));
    await collection
      .groupBy('userId')
      .having((having) => having.max(numericField).lt(99))
      .aggregate((aggregate) => ({ max: aggregate.max(numericField) }));
    await collection
      .groupBy('userId')
      .having((having) => having.count().gte(2))
      .aggregate((aggregate) => ({ count: aggregate.count() }));
    await collection
      .groupBy('userId')
      .having((having) => having.count().lte(2))
      .aggregate((aggregate) => ({ count: aggregate.count() }));

    const havingComparisons = runtime.executions
      .map((entry) => {
        if (!isSelectAst(entry.plan.ast)) {
          return undefined;
        }
        const having = entry.plan.ast.having;
        if (having?.kind !== 'binary' || having.left.kind !== 'aggregate') {
          return undefined;
        }
        return `${having.left.fn}:${having.op}`;
      })
      .filter((comparison): comparison is string => comparison !== undefined);

    expect(havingComparisons).toHaveLength(6);
    expect(new Set(havingComparisons)).toEqual(
      new Set(['sum:eq', 'avg:neq', 'min:gt', 'max:lt', 'count:gte', 'count:lte']),
    );
  });

  it('groupBy().aggregate() coerces aggregate value types from runtime rows', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([
      [
        {
          user_id: 1,
          count: undefined,
          total: 10n,
          max: 'not-a-number',
        },
      ],
    ]);

    const numericField = 'views' as never;
    const rows = await collection.groupBy('userId').aggregate((aggregate) => ({
      count: aggregate.count(),
      total: aggregate.sum(numericField),
      max: aggregate.max(numericField),
    }));

    expect(rows).toEqual([{ userId: 1, count: 0, total: 10, max: 'not-a-number' }]);
  });

  it('groupBy().aggregate() coerces null, numeric, undefined, and object aggregate values', async () => {
    const { collection, runtime } = createCollectionFor('Post');
    runtime.setNextResults([
      [
        {
          user_id: 1,
          count: null,
          total: 5,
          avg: undefined,
          max: { raw: true },
        },
      ],
    ]);

    const numericField = 'views' as never;
    const rows = await collection.groupBy('userId').aggregate((aggregate) => ({
      count: aggregate.count(),
      total: aggregate.sum(numericField),
      avg: aggregate.avg(numericField),
      max: aggregate.max(numericField),
    }));

    expect(rows).toEqual([
      {
        userId: 1,
        count: null,
        total: 5,
        avg: null,
        max: { raw: true },
      },
    ]);
  });

  it('only exposes grouped operations at runtime', () => {
    const { collection } = createCollectionFor('Post');
    const grouped = collection.groupBy('userId') as unknown as Record<string, unknown>;

    expect(typeof grouped['having']).toBe('function');
    expect(typeof grouped['aggregate']).toBe('function');
    expect(grouped['all']).toBeUndefined();
    expect(grouped['first']).toBeUndefined();
    expect(grouped['include']).toBeUndefined();
    expect(grouped['select']).toBeUndefined();
  });
});
