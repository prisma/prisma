import { describe, expect, it } from 'vitest';
import type { MongoAggExpr } from '../src/aggregation-expressions';
import {
  MongoAggAccumulator,
  MongoAggCond,
  MongoAggFieldRef,
  MongoAggLiteral,
  MongoAggOperator,
} from '../src/aggregation-expressions';
import { MongoFieldFilter } from '../src/filter-expressions';
import {
  MongoAddFieldsStage,
  MongoBucketAutoStage,
  MongoBucketStage,
  MongoCountStage,
  MongoDensifyStage,
  MongoFacetStage,
  MongoFillStage,
  MongoGeoNearStage,
  MongoGraphLookupStage,
  MongoGroupStage,
  MongoLimitStage,
  MongoLookupStage,
  MongoMatchStage,
  MongoMergeStage,
  MongoOutStage,
  MongoProjectStage,
  MongoRedactStage,
  MongoReplaceRootStage,
  MongoSampleStage,
  MongoSearchMetaStage,
  MongoSearchStage,
  MongoSetWindowFieldsStage,
  MongoSkipStage,
  MongoSortByCountStage,
  MongoSortStage,
  MongoUnionWithStage,
  MongoUnwindStage,
  MongoVectorSearchStage,
} from '../src/stages';
import type { MongoAggExprRewriter, MongoStageVisitor } from '../src/visitors';

function prefixFieldRefRewriter(prefix: string): MongoAggExprRewriter {
  return { fieldRef: (expr) => MongoAggFieldRef.of(`${prefix}${expr.path}`) };
}

describe('MongoGroupStage', () => {
  it('stores groupId and accumulators', () => {
    const stage = new MongoGroupStage(MongoAggFieldRef.of('department'), {
      total: MongoAggAccumulator.sum(MongoAggFieldRef.of('amount')),
    });
    expect(stage.kind).toBe('group');
    expect((stage.groupId as MongoAggFieldRef).path).toBe('department');
    expect(stage.accumulators['total']!.op).toBe('$sum');
  });

  it('accepts null groupId for global group', () => {
    const stage = new MongoGroupStage(null, {
      count: MongoAggAccumulator.count(),
    });
    expect(stage.groupId).toBeNull();
  });

  it('accepts compound groupId', () => {
    const stage = new MongoGroupStage(
      { dept: MongoAggFieldRef.of('department'), year: MongoAggFieldRef.of('year') },
      { total: MongoAggAccumulator.sum(MongoAggFieldRef.of('amount')) },
    );
    expect((stage.groupId as Record<string, MongoAggExpr>)['dept']).toBeDefined();
    expect((stage.groupId as Record<string, MongoAggExpr>)['year']).toBeDefined();
  });

  it('rewrite() handles compound groupId with a "kind" key correctly', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoGroupStage(
      { kind: MongoAggFieldRef.of('type'), dept: MongoAggFieldRef.of('department') },
      { total: MongoAggAccumulator.sum(MongoAggFieldRef.of('amount')) },
    );
    const rewritten = stage.rewrite({ aggExpr }) as MongoGroupStage;
    const compoundId = rewritten.groupId as Record<string, MongoAggExpr>;
    expect((compoundId['kind'] as MongoAggFieldRef).path).toBe('r.type');
    expect((compoundId['dept'] as MongoAggFieldRef).path).toBe('r.department');
  });

  it('is frozen', () => {
    const stage = new MongoGroupStage(MongoAggFieldRef.of('x'), {
      total: MongoAggAccumulator.sum(MongoAggFieldRef.of('y')),
    });
    expect(Object.isFrozen(stage)).toBe(true);
    expect(Object.isFrozen(stage.accumulators)).toBe(true);
  });

  it('rewrite() recurses into groupId and accumulator expressions', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoGroupStage(MongoAggFieldRef.of('dept'), {
      total: MongoAggAccumulator.sum(MongoAggFieldRef.of('amount')),
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoGroupStage;
    expect((rewritten.groupId as MongoAggFieldRef).path).toBe('r.dept');
    expect((rewritten.accumulators['total']!.arg as MongoAggFieldRef).path).toBe('r.amount');
  });

  it('rewrite() recurses into compound groupId', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoGroupStage(
      { dept: MongoAggFieldRef.of('department') },
      { total: MongoAggAccumulator.sum(MongoAggFieldRef.of('amount')) },
    );
    const rewritten = stage.rewrite({ aggExpr }) as MongoGroupStage;
    const compoundId = rewritten.groupId as Record<string, MongoAggExpr>;
    expect((compoundId['dept'] as MongoAggFieldRef).path).toBe('r.department');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoGroupStage(null, {
      count: MongoAggAccumulator.count(),
    });
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoAddFieldsStage', () => {
  it('stores computed fields', () => {
    const stage = new MongoAddFieldsStage({
      fullName: MongoAggOperator.of('$concat', [
        MongoAggFieldRef.of('first'),
        MongoAggLiteral.of(' '),
        MongoAggFieldRef.of('last'),
      ]),
    });
    expect(stage.kind).toBe('addFields');
    expect(stage.fields['fullName']).toBeDefined();
  });

  it('is frozen', () => {
    const stage = new MongoAddFieldsStage({ x: MongoAggLiteral.of(1) });
    expect(Object.isFrozen(stage)).toBe(true);
    expect(Object.isFrozen(stage.fields)).toBe(true);
  });

  it('rewrite() recurses into field expressions', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoAddFieldsStage({ total: MongoAggFieldRef.of('amount') });
    const rewritten = stage.rewrite({ aggExpr }) as MongoAddFieldsStage;
    expect((rewritten.fields['total'] as MongoAggFieldRef).path).toBe('r.amount');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoAddFieldsStage({ x: MongoAggLiteral.of(1) });
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoReplaceRootStage', () => {
  it('stores newRoot expression', () => {
    const stage = new MongoReplaceRootStage(MongoAggFieldRef.of('address'));
    expect(stage.kind).toBe('replaceRoot');
    expect((stage.newRoot as MongoAggFieldRef).path).toBe('address');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(new MongoReplaceRootStage(MongoAggFieldRef.of('x')))).toBe(true);
  });

  it('rewrite() recurses into newRoot', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoReplaceRootStage(MongoAggFieldRef.of('address'));
    const rewritten = stage.rewrite({ aggExpr }) as MongoReplaceRootStage;
    expect((rewritten.newRoot as MongoAggFieldRef).path).toBe('r.address');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoReplaceRootStage(MongoAggLiteral.of(1));
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoCountStage', () => {
  it('stores field name', () => {
    const stage = new MongoCountStage('total');
    expect(stage.kind).toBe('count');
    expect(stage.field).toBe('total');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(new MongoCountStage('total'))).toBe(true);
  });

  it('rewrite() returns this (scalar only)', () => {
    const stage = new MongoCountStage('total');
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoSortByCountStage', () => {
  it('stores expression', () => {
    const stage = new MongoSortByCountStage(MongoAggFieldRef.of('status'));
    expect(stage.kind).toBe('sortByCount');
    expect((stage.expr as MongoAggFieldRef).path).toBe('status');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(new MongoSortByCountStage(MongoAggFieldRef.of('x')))).toBe(true);
  });

  it('rewrite() recurses into expression', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoSortByCountStage(MongoAggFieldRef.of('status'));
    const rewritten = stage.rewrite({ aggExpr }) as MongoSortByCountStage;
    expect((rewritten.expr as MongoAggFieldRef).path).toBe('r.status');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoSortByCountStage(MongoAggLiteral.of('x'));
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoSampleStage', () => {
  it('stores size', () => {
    const stage = new MongoSampleStage(10);
    expect(stage.kind).toBe('sample');
    expect(stage.size).toBe(10);
  });

  it('accepts zero', () => {
    expect(new MongoSampleStage(0).size).toBe(0);
  });

  it('rejects negative values', () => {
    expect(() => new MongoSampleStage(-1)).toThrow('size must be a non-negative integer');
  });

  it('rejects non-integer values', () => {
    expect(() => new MongoSampleStage(1.5)).toThrow('size must be a non-negative integer');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(new MongoSampleStage(5))).toBe(true);
  });

  it('rewrite() returns this (scalar only)', () => {
    const stage = new MongoSampleStage(5);
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoRedactStage', () => {
  it('stores expression', () => {
    const expr = MongoAggCond.of(
      MongoAggOperator.of('$eq', [MongoAggFieldRef.of('level'), MongoAggLiteral.of(5)]),
      MongoAggLiteral.of('$$PRUNE'),
      MongoAggLiteral.of('$$DESCEND'),
    );
    const stage = new MongoRedactStage(expr);
    expect(stage.kind).toBe('redact');
    expect(stage.expr).toBe(expr);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(new MongoRedactStage(MongoAggLiteral.of('$$KEEP')))).toBe(true);
  });

  it('rewrite() recurses into expression', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoRedactStage(MongoAggFieldRef.of('level'));
    const rewritten = stage.rewrite({ aggExpr }) as MongoRedactStage;
    expect((rewritten.expr as MongoAggFieldRef).path).toBe('r.level');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoRedactStage(MongoAggLiteral.of('$$KEEP'));
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoOutStage', () => {
  it('stores collection and optional db', () => {
    const stage = new MongoOutStage('results');
    expect(stage.kind).toBe('out');
    expect(stage.collection).toBe('results');
    expect(stage.db).toBeUndefined();
  });

  it('stores db when provided', () => {
    const stage = new MongoOutStage('results', 'archive');
    expect(stage.db).toBe('archive');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(new MongoOutStage('results'))).toBe(true);
  });

  it('rewrite() returns this (no expressions)', () => {
    const stage = new MongoOutStage('results');
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoUnionWithStage', () => {
  it('stores collection', () => {
    const stage = new MongoUnionWithStage('other');
    expect(stage.kind).toBe('unionWith');
    expect(stage.collection).toBe('other');
    expect(stage.pipeline).toBeUndefined();
  });

  it('stores pipeline when provided', () => {
    const pipeline = [new MongoMatchStage(MongoFieldFilter.eq('active', true))];
    const stage = new MongoUnionWithStage('other', pipeline);
    expect(stage.pipeline).toHaveLength(1);
  });

  it('is frozen', () => {
    const stage = new MongoUnionWithStage('other');
    expect(Object.isFrozen(stage)).toBe(true);
  });

  it('rewrite() returns this without pipeline', () => {
    const stage = new MongoUnionWithStage('other');
    expect(stage.rewrite({})).toBe(stage);
  });

  it('rewrite() recurses into pipeline', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoUnionWithStage('other', [
      new MongoAddFieldsStage({ total: MongoAggFieldRef.of('amount') }),
    ]);
    const rewritten = stage.rewrite({ aggExpr }) as MongoUnionWithStage;
    const addFields = rewritten.pipeline![0] as MongoAddFieldsStage;
    expect((addFields.fields['total'] as MongoAggFieldRef).path).toBe('r.amount');
  });
});

describe('MongoBucketStage', () => {
  it('stores groupBy and boundaries', () => {
    const stage = new MongoBucketStage({
      groupBy: MongoAggFieldRef.of('price'),
      boundaries: [0, 100, 500],
    });
    expect(stage.kind).toBe('bucket');
    expect((stage.groupBy as MongoAggFieldRef).path).toBe('price');
    expect(stage.boundaries).toEqual([0, 100, 500]);
  });

  it('is frozen', () => {
    const stage = new MongoBucketStage({
      groupBy: MongoAggFieldRef.of('price'),
      boundaries: [0, 100],
    });
    expect(Object.isFrozen(stage)).toBe(true);
    expect(Object.isFrozen(stage.boundaries)).toBe(true);
  });

  it('rewrite() recurses into groupBy', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoBucketStage({
      groupBy: MongoAggFieldRef.of('price'),
      boundaries: [0, 100],
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoBucketStage;
    expect((rewritten.groupBy as MongoAggFieldRef).path).toBe('r.price');
  });

  it('rewrite() recurses into output accumulators', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoBucketStage({
      groupBy: MongoAggFieldRef.of('price'),
      boundaries: [0, 100],
      output: { total: MongoAggAccumulator.sum(MongoAggFieldRef.of('amount')) },
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoBucketStage;
    const acc = rewritten.output!['total']!;
    expect((acc.arg as MongoAggFieldRef).path).toBe('r.amount');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoBucketStage({
      groupBy: MongoAggFieldRef.of('price'),
      boundaries: [0, 100],
    });
    expect(stage.rewrite({})).toBe(stage);
  });

  it('throws if boundaries has fewer than 2 values', () => {
    expect(
      () =>
        new MongoBucketStage({
          groupBy: MongoAggFieldRef.of('price'),
          boundaries: [0],
        }),
    ).toThrow('boundaries must contain at least 2 values');
  });
});

describe('MongoBucketAutoStage', () => {
  it('stores groupBy and buckets', () => {
    const stage = new MongoBucketAutoStage({
      groupBy: MongoAggFieldRef.of('price'),
      buckets: 5,
    });
    expect(stage.kind).toBe('bucketAuto');
    expect(stage.buckets).toBe(5);
  });

  it('is frozen', () => {
    const stage = new MongoBucketAutoStage({
      groupBy: MongoAggFieldRef.of('price'),
      buckets: 5,
    });
    expect(Object.isFrozen(stage)).toBe(true);
  });

  it('rewrite() recurses into groupBy', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoBucketAutoStage({
      groupBy: MongoAggFieldRef.of('price'),
      buckets: 5,
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoBucketAutoStage;
    expect((rewritten.groupBy as MongoAggFieldRef).path).toBe('r.price');
  });

  it('rewrite() recurses into output accumulators', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoBucketAutoStage({
      groupBy: MongoAggFieldRef.of('price'),
      buckets: 5,
      output: { avg: MongoAggAccumulator.avg(MongoAggFieldRef.of('score')) },
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoBucketAutoStage;
    const acc = rewritten.output!['avg']!;
    expect((acc.arg as MongoAggFieldRef).path).toBe('r.score');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoBucketAutoStage({
      groupBy: MongoAggFieldRef.of('price'),
      buckets: 5,
    });
    expect(stage.rewrite({})).toBe(stage);
  });

  it('throws if buckets is not a positive integer', () => {
    expect(
      () =>
        new MongoBucketAutoStage({
          groupBy: MongoAggFieldRef.of('price'),
          buckets: 0,
        }),
    ).toThrow('buckets must be a positive integer');
    expect(
      () =>
        new MongoBucketAutoStage({
          groupBy: MongoAggFieldRef.of('price'),
          buckets: -1,
        }),
    ).toThrow('buckets must be a positive integer');
    expect(
      () =>
        new MongoBucketAutoStage({
          groupBy: MongoAggFieldRef.of('price'),
          buckets: 2.5,
        }),
    ).toThrow('buckets must be a positive integer');
  });
});

describe('MongoGeoNearStage', () => {
  it('stores near and distanceField', () => {
    const stage = new MongoGeoNearStage({
      near: { type: 'Point', coordinates: [0, 0] },
      distanceField: 'dist',
    });
    expect(stage.kind).toBe('geoNear');
    expect(stage.distanceField).toBe('dist');
  });

  it('is frozen', () => {
    const stage = new MongoGeoNearStage({
      near: [0, 0],
      distanceField: 'dist',
    });
    expect(Object.isFrozen(stage)).toBe(true);
  });

  it('rewrite() recurses into query filter', () => {
    const filter = { field: () => MongoFieldFilter.eq('rewritten', true) };
    const stage = new MongoGeoNearStage({
      near: [0, 0],
      distanceField: 'dist',
      query: MongoFieldFilter.eq('active', true),
    });
    const rewritten = stage.rewrite({ filter }) as MongoGeoNearStage;
    expect(rewritten).not.toBe(stage);
    expect(rewritten.query!.kind).toBe('field');
    const rewrittenFilter = rewritten.query as MongoFieldFilter;
    expect(rewrittenFilter.field).toBe('rewritten');
    expect(rewrittenFilter.value).toBe(true);
  });

  it('rewrite() returns this without query', () => {
    const stage = new MongoGeoNearStage({
      near: [0, 0],
      distanceField: 'dist',
    });
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoFacetStage', () => {
  it('stores facets', () => {
    const stage = new MongoFacetStage({
      prices: [
        new MongoGroupStage(null, { avg: MongoAggAccumulator.avg(MongoAggFieldRef.of('price')) }),
      ],
      counts: [new MongoCountStage('total')],
    });
    expect(stage.kind).toBe('facet');
    expect(Object.keys(stage.facets)).toEqual(['prices', 'counts']);
  });

  it('is frozen', () => {
    const stage = new MongoFacetStage({
      a: [new MongoCountStage('n')],
    });
    expect(Object.isFrozen(stage)).toBe(true);
    expect(Object.isFrozen(stage.facets)).toBe(true);
    expect(Object.isFrozen(stage.facets['a'])).toBe(true);
  });

  it('rewrite() recurses into each facet pipeline', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoFacetStage({
      totals: [new MongoAddFieldsStage({ x: MongoAggFieldRef.of('amount') })],
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoFacetStage;
    const addFields = rewritten.facets['totals']![0] as MongoAddFieldsStage;
    expect((addFields.fields['x'] as MongoAggFieldRef).path).toBe('r.amount');
  });
});

describe('MongoGraphLookupStage', () => {
  it('stores required fields', () => {
    const stage = new MongoGraphLookupStage({
      from: 'employees',
      startWith: MongoAggFieldRef.of('reportsTo'),
      connectFromField: 'reportsTo',
      connectToField: 'name',
      as: 'hierarchy',
    });
    expect(stage.kind).toBe('graphLookup');
    expect(stage.from).toBe('employees');
    expect(stage.as).toBe('hierarchy');
  });

  it('is frozen', () => {
    const stage = new MongoGraphLookupStage({
      from: 'e',
      startWith: MongoAggFieldRef.of('x'),
      connectFromField: 'a',
      connectToField: 'b',
      as: 'c',
    });
    expect(Object.isFrozen(stage)).toBe(true);
  });

  it('rewrite() recurses into startWith', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoGraphLookupStage({
      from: 'e',
      startWith: MongoAggFieldRef.of('reportsTo'),
      connectFromField: 'reportsTo',
      connectToField: 'name',
      as: 'h',
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoGraphLookupStage;
    expect((rewritten.startWith as MongoAggFieldRef).path).toBe('r.reportsTo');
  });

  it('rewrite() recurses into restrictSearchWithMatch', () => {
    const filter = { field: () => MongoFieldFilter.eq('rewritten', true) };
    const stage = new MongoGraphLookupStage({
      from: 'e',
      startWith: MongoAggFieldRef.of('x'),
      connectFromField: 'a',
      connectToField: 'b',
      as: 'c',
      restrictSearchWithMatch: MongoFieldFilter.eq('active', true),
    });
    const rewritten = stage.rewrite({ filter }) as MongoGraphLookupStage;
    expect(rewritten).not.toBe(stage);
    expect(rewritten.restrictSearchWithMatch!.kind).toBe('field');
    const rewrittenFilter = rewritten.restrictSearchWithMatch as MongoFieldFilter;
    expect(rewrittenFilter.field).toBe('rewritten');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoGraphLookupStage({
      from: 'e',
      startWith: MongoAggFieldRef.of('x'),
      connectFromField: 'a',
      connectToField: 'b',
      as: 'c',
    });
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoMergeStage', () => {
  it('stores into as string', () => {
    const stage = new MongoMergeStage({ into: 'output' });
    expect(stage.kind).toBe('merge');
    expect(stage.into).toBe('output');
  });

  it('stores into as object', () => {
    const stage = new MongoMergeStage({ into: { db: 'archive', coll: 'results' } });
    expect(stage.into).toEqual({ db: 'archive', coll: 'results' });
  });

  it('is frozen', () => {
    const stage = new MongoMergeStage({ into: 'output' });
    expect(Object.isFrozen(stage)).toBe(true);
  });

  it('rewrite() returns this with string whenMatched', () => {
    const stage = new MongoMergeStage({ into: 'output', whenMatched: 'replace' });
    expect(stage.rewrite({})).toBe(stage);
  });

  it('rewrite() recurses into whenMatched pipeline', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoMergeStage({
      into: 'output',
      whenMatched: [new MongoAddFieldsStage({ x: MongoAggFieldRef.of('amount') })],
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoMergeStage;
    const pipeline = rewritten.whenMatched as MongoAddFieldsStage[];
    expect((pipeline[0]!.fields['x'] as MongoAggFieldRef).path).toBe('r.amount');
  });

  it('rewrite() preserves object into through rewrite', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoMergeStage({
      into: { db: 'archive', coll: 'results' },
      whenMatched: [new MongoAddFieldsStage({ x: MongoAggFieldRef.of('amount') })],
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoMergeStage;
    expect(rewritten.into).toEqual({ db: 'archive', coll: 'results' });
    const pipeline = rewritten.whenMatched as MongoAddFieldsStage[];
    expect((pipeline[0]!.fields['x'] as MongoAggFieldRef).path).toBe('r.amount');
  });
});

describe('MongoSetWindowFieldsStage', () => {
  it('stores output', () => {
    const stage = new MongoSetWindowFieldsStage({
      output: {
        runningTotal: { operator: MongoAggAccumulator.sum(MongoAggFieldRef.of('amount')) },
      },
    });
    expect(stage.kind).toBe('setWindowFields');
    expect(stage.output['runningTotal']).toBeDefined();
  });

  it('is frozen', () => {
    const stage = new MongoSetWindowFieldsStage({
      output: { x: { operator: MongoAggAccumulator.sum(MongoAggFieldRef.of('a')) } },
    });
    expect(Object.isFrozen(stage)).toBe(true);
  });

  it('rewrite() recurses into partitionBy and output operators', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoSetWindowFieldsStage({
      partitionBy: MongoAggFieldRef.of('dept'),
      output: { total: { operator: MongoAggAccumulator.sum(MongoAggFieldRef.of('amount')) } },
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoSetWindowFieldsStage;
    expect((rewritten.partitionBy as MongoAggFieldRef).path).toBe('r.dept');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoSetWindowFieldsStage({
      output: { x: { operator: MongoAggAccumulator.count() } },
    });
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoDensifyStage', () => {
  it('stores field and range', () => {
    const stage = new MongoDensifyStage({
      field: 'timestamp',
      range: { step: 1, unit: 'hour', bounds: 'full' },
    });
    expect(stage.kind).toBe('densify');
    expect(stage.field).toBe('timestamp');
    expect(stage.range.step).toBe(1);
  });

  it('is frozen', () => {
    const stage = new MongoDensifyStage({
      field: 'ts',
      range: { step: 1, bounds: 'full' },
    });
    expect(Object.isFrozen(stage)).toBe(true);
  });

  it('rewrite() returns this (no expressions)', () => {
    const stage = new MongoDensifyStage({
      field: 'ts',
      range: { step: 1, bounds: 'full' },
    });
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoFillStage', () => {
  it('stores output with method', () => {
    const stage = new MongoFillStage({
      sortBy: { ts: 1 },
      output: { qty: { method: 'linear' } },
    });
    expect(stage.kind).toBe('fill');
    expect(stage.output['qty']!.method).toBe('linear');
  });

  it('is frozen', () => {
    const stage = new MongoFillStage({
      output: { x: { method: 'locf' } },
    });
    expect(Object.isFrozen(stage)).toBe(true);
  });

  it('rewrite() recurses into partitionBy and output values', () => {
    const aggExpr = prefixFieldRefRewriter('r.');
    const stage = new MongoFillStage({
      partitionBy: MongoAggFieldRef.of('region'),
      output: { price: { value: MongoAggFieldRef.of('defaultPrice') } },
    });
    const rewritten = stage.rewrite({ aggExpr }) as MongoFillStage;
    expect((rewritten.partitionBy as MongoAggFieldRef).path).toBe('r.region');
    expect((rewritten.output['price']!.value as MongoAggFieldRef).path).toBe('r.defaultPrice');
  });

  it('rewrite() returns this with empty context', () => {
    const stage = new MongoFillStage({
      output: { x: { method: 'locf' } },
    });
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoSearchStage', () => {
  it('stores config and optional index', () => {
    const stage = new MongoSearchStage({ text: { query: 'hello', path: 'body' } });
    expect(stage.kind).toBe('search');
    expect(stage.config['text']).toBeDefined();
    expect(stage.index).toBeUndefined();
  });

  it('stores index when provided', () => {
    const stage = new MongoSearchStage({ text: { query: 'hi' } }, 'myIndex');
    expect(stage.index).toBe('myIndex');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(new MongoSearchStage({ text: {} }))).toBe(true);
  });

  it('rewrite() returns this (opaque config)', () => {
    const stage = new MongoSearchStage({ text: {} });
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoSearchMetaStage', () => {
  it('stores config', () => {
    const stage = new MongoSearchMetaStage({ facet: {} });
    expect(stage.kind).toBe('searchMeta');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(new MongoSearchMetaStage({ facet: {} }))).toBe(true);
  });

  it('rewrite() returns this (opaque config)', () => {
    const stage = new MongoSearchMetaStage({ facet: {} });
    expect(stage.rewrite({})).toBe(stage);
  });
});

describe('MongoVectorSearchStage', () => {
  it('stores required fields', () => {
    const stage = new MongoVectorSearchStage({
      index: 'vec_idx',
      path: 'embedding',
      queryVector: [0.1, 0.2, 0.3],
      numCandidates: 100,
      limit: 10,
    });
    expect(stage.kind).toBe('vectorSearch');
    expect(stage.index).toBe('vec_idx');
    expect(stage.queryVector).toEqual([0.1, 0.2, 0.3]);
  });

  it('is frozen', () => {
    const stage = new MongoVectorSearchStage({
      index: 'i',
      path: 'p',
      queryVector: [1],
      numCandidates: 10,
      limit: 5,
    });
    expect(Object.isFrozen(stage)).toBe(true);
    expect(Object.isFrozen(stage.queryVector)).toBe(true);
  });

  it('rewrite() returns this (opaque config)', () => {
    const stage = new MongoVectorSearchStage({
      index: 'i',
      path: 'p',
      queryVector: [1],
      numCandidates: 10,
      limit: 5,
    });
    expect(stage.rewrite({})).toBe(stage);
  });

  it('throws if limit is not a positive integer', () => {
    expect(
      () =>
        new MongoVectorSearchStage({
          index: 'i',
          path: 'p',
          queryVector: [1],
          numCandidates: 10,
          limit: 0,
        }),
    ).toThrow('limit must be a positive integer');
  });

  it('throws if numCandidates < limit', () => {
    expect(
      () =>
        new MongoVectorSearchStage({
          index: 'i',
          path: 'p',
          queryVector: [1],
          numCandidates: 3,
          limit: 5,
        }),
    ).toThrow('numCandidates must be an integer >= limit');
  });
});

describe('MongoStageVisitor', () => {
  const kindVisitor: MongoStageVisitor<string> = {
    match: () => 'match',
    project: () => 'project',
    sort: () => 'sort',
    limit: () => 'limit',
    skip: () => 'skip',
    lookup: () => 'lookup',
    unwind: () => 'unwind',
    group: () => 'group',
    addFields: () => 'addFields',
    replaceRoot: () => 'replaceRoot',
    count: () => 'count',
    sortByCount: () => 'sortByCount',
    sample: () => 'sample',
    redact: () => 'redact',
    out: () => 'out',
    unionWith: () => 'unionWith',
    bucket: () => 'bucket',
    bucketAuto: () => 'bucketAuto',
    geoNear: () => 'geoNear',
    facet: () => 'facet',
    graphLookup: () => 'graphLookup',
    merge: () => 'merge',
    setWindowFields: () => 'setWindowFields',
    densify: () => 'densify',
    fill: () => 'fill',
    search: () => 'search',
    searchMeta: () => 'searchMeta',
    vectorSearch: () => 'vectorSearch',
  };

  it('dispatches match', () => {
    expect(new MongoMatchStage(MongoFieldFilter.eq('x', 1)).accept(kindVisitor)).toBe('match');
  });

  it('dispatches project', () => {
    expect(new MongoProjectStage({ x: 1 }).accept(kindVisitor)).toBe('project');
  });

  it('dispatches sort', () => {
    expect(new MongoSortStage({ x: 1 }).accept(kindVisitor)).toBe('sort');
  });

  it('dispatches limit', () => {
    expect(new MongoLimitStage(10).accept(kindVisitor)).toBe('limit');
  });

  it('dispatches skip', () => {
    expect(new MongoSkipStage(5).accept(kindVisitor)).toBe('skip');
  });

  it('dispatches lookup', () => {
    const stage = new MongoLookupStage({
      from: 'posts',
      localField: '_id',
      foreignField: 'authorId',
      as: 'posts',
    });
    expect(stage.accept(kindVisitor)).toBe('lookup');
  });

  it('dispatches unwind', () => {
    expect(new MongoUnwindStage('$posts', true).accept(kindVisitor)).toBe('unwind');
  });

  it('dispatches group', () => {
    const stage = new MongoGroupStage(null, { count: MongoAggAccumulator.count() });
    expect(stage.accept(kindVisitor)).toBe('group');
  });

  it('dispatches addFields', () => {
    expect(new MongoAddFieldsStage({ x: MongoAggLiteral.of(1) }).accept(kindVisitor)).toBe(
      'addFields',
    );
  });

  it('dispatches replaceRoot', () => {
    expect(new MongoReplaceRootStage(MongoAggFieldRef.of('x')).accept(kindVisitor)).toBe(
      'replaceRoot',
    );
  });

  it('dispatches count', () => {
    expect(new MongoCountStage('total').accept(kindVisitor)).toBe('count');
  });

  it('dispatches sortByCount', () => {
    expect(new MongoSortByCountStage(MongoAggFieldRef.of('status')).accept(kindVisitor)).toBe(
      'sortByCount',
    );
  });

  it('dispatches sample', () => {
    expect(new MongoSampleStage(5).accept(kindVisitor)).toBe('sample');
  });

  it('dispatches redact', () => {
    expect(new MongoRedactStage(MongoAggLiteral.of('$$KEEP')).accept(kindVisitor)).toBe('redact');
  });

  it('dispatches out', () => {
    expect(new MongoOutStage('results').accept(kindVisitor)).toBe('out');
  });

  it('dispatches unionWith', () => {
    expect(new MongoUnionWithStage('other').accept(kindVisitor)).toBe('unionWith');
  });

  it('dispatches bucket', () => {
    const stage = new MongoBucketStage({
      groupBy: MongoAggFieldRef.of('price'),
      boundaries: [0, 100],
    });
    expect(stage.accept(kindVisitor)).toBe('bucket');
  });

  it('dispatches bucketAuto', () => {
    const stage = new MongoBucketAutoStage({
      groupBy: MongoAggFieldRef.of('price'),
      buckets: 5,
    });
    expect(stage.accept(kindVisitor)).toBe('bucketAuto');
  });

  it('dispatches geoNear', () => {
    const stage = new MongoGeoNearStage({ near: [0, 0], distanceField: 'dist' });
    expect(stage.accept(kindVisitor)).toBe('geoNear');
  });

  it('dispatches facet', () => {
    const stage = new MongoFacetStage({ a: [new MongoCountStage('n')] });
    expect(stage.accept(kindVisitor)).toBe('facet');
  });

  it('dispatches graphLookup', () => {
    const stage = new MongoGraphLookupStage({
      from: 'e',
      startWith: MongoAggFieldRef.of('x'),
      connectFromField: 'a',
      connectToField: 'b',
      as: 'c',
    });
    expect(stage.accept(kindVisitor)).toBe('graphLookup');
  });

  it('dispatches merge', () => {
    expect(new MongoMergeStage({ into: 'output' }).accept(kindVisitor)).toBe('merge');
  });

  it('dispatches setWindowFields', () => {
    const stage = new MongoSetWindowFieldsStage({
      output: { x: { operator: MongoAggAccumulator.count() } },
    });
    expect(stage.accept(kindVisitor)).toBe('setWindowFields');
  });

  it('dispatches densify', () => {
    const stage = new MongoDensifyStage({ field: 'ts', range: { step: 1, bounds: 'full' } });
    expect(stage.accept(kindVisitor)).toBe('densify');
  });

  it('dispatches fill', () => {
    const stage = new MongoFillStage({ output: { x: { method: 'locf' } } });
    expect(stage.accept(kindVisitor)).toBe('fill');
  });

  it('dispatches search', () => {
    expect(new MongoSearchStage({ text: {} }).accept(kindVisitor)).toBe('search');
  });

  it('dispatches searchMeta', () => {
    expect(new MongoSearchMetaStage({ facet: {} }).accept(kindVisitor)).toBe('searchMeta');
  });

  it('dispatches vectorSearch', () => {
    const stage = new MongoVectorSearchStage({
      index: 'i',
      path: 'p',
      queryVector: [1],
      numCandidates: 10,
      limit: 5,
    });
    expect(stage.accept(kindVisitor)).toBe('vectorSearch');
  });
});
