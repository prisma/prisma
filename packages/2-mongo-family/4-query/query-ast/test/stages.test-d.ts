import { assertType, expectTypeOf, test } from 'vitest';
import type { MongoAggAccumulator, MongoAggExpr } from '../src/aggregation-expressions';
import type {
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
  MongoPipelineStage,
  MongoProjectionValue,
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
import type { MongoStageVisitor } from '../src/visitors';

test('each concrete stage class is assignable to MongoPipelineStage', () => {
  expectTypeOf<MongoMatchStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoProjectStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoSortStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoLimitStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoSkipStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoLookupStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoUnwindStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoGroupStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoAddFieldsStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoReplaceRootStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoCountStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoSortByCountStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoSampleStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoRedactStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoOutStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoUnionWithStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoBucketStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoBucketAutoStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoGeoNearStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoFacetStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoGraphLookupStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoMergeStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoSetWindowFieldsStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoDensifyStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoFillStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoSearchStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoSearchMetaStage>().toExtend<MongoPipelineStage>();
  expectTypeOf<MongoVectorSearchStage>().toExtend<MongoPipelineStage>();
});

test('MongoPipelineStage kind union covers all 28 kinds', () => {
  expectTypeOf<MongoPipelineStage['kind']>().toEqualTypeOf<
    | 'match'
    | 'project'
    | 'sort'
    | 'limit'
    | 'skip'
    | 'lookup'
    | 'unwind'
    | 'group'
    | 'addFields'
    | 'replaceRoot'
    | 'count'
    | 'sortByCount'
    | 'sample'
    | 'redact'
    | 'out'
    | 'unionWith'
    | 'bucket'
    | 'bucketAuto'
    | 'geoNear'
    | 'facet'
    | 'graphLookup'
    | 'merge'
    | 'setWindowFields'
    | 'densify'
    | 'fill'
    | 'search'
    | 'searchMeta'
    | 'vectorSearch'
  >();
});

test('switching on kind is exhaustive', () => {
  function exhaustiveSwitch(stage: MongoPipelineStage): string {
    switch (stage.kind) {
      case 'match':
        return 'match';
      case 'project':
        return 'project';
      case 'sort':
        return 'sort';
      case 'limit':
        return 'limit';
      case 'skip':
        return 'skip';
      case 'lookup':
        return 'lookup';
      case 'unwind':
        return 'unwind';
      case 'group':
        return 'group';
      case 'addFields':
        return 'addFields';
      case 'replaceRoot':
        return 'replaceRoot';
      case 'count':
        return 'count';
      case 'sortByCount':
        return 'sortByCount';
      case 'sample':
        return 'sample';
      case 'redact':
        return 'redact';
      case 'out':
        return 'out';
      case 'unionWith':
        return 'unionWith';
      case 'bucket':
        return 'bucket';
      case 'bucketAuto':
        return 'bucketAuto';
      case 'geoNear':
        return 'geoNear';
      case 'facet':
        return 'facet';
      case 'graphLookup':
        return 'graphLookup';
      case 'merge':
        return 'merge';
      case 'setWindowFields':
        return 'setWindowFields';
      case 'densify':
        return 'densify';
      case 'fill':
        return 'fill';
      case 'search':
        return 'search';
      case 'searchMeta':
        return 'searchMeta';
      case 'vectorSearch':
        return 'vectorSearch';
      default: {
        const _exhaustive: never = stage;
        return _exhaustive;
      }
    }
  }
  assertType<(stage: MongoPipelineStage) => string>(exhaustiveSwitch);
});

test('MongoStageVisitor requires all 28 methods', () => {
  type Complete = MongoStageVisitor<string>;

  expectTypeOf<Complete>().toHaveProperty('match');
  expectTypeOf<Complete>().toHaveProperty('project');
  expectTypeOf<Complete>().toHaveProperty('sort');
  expectTypeOf<Complete>().toHaveProperty('limit');
  expectTypeOf<Complete>().toHaveProperty('skip');
  expectTypeOf<Complete>().toHaveProperty('lookup');
  expectTypeOf<Complete>().toHaveProperty('unwind');
  expectTypeOf<Complete>().toHaveProperty('group');
  expectTypeOf<Complete>().toHaveProperty('addFields');
  expectTypeOf<Complete>().toHaveProperty('replaceRoot');
  expectTypeOf<Complete>().toHaveProperty('count');
  expectTypeOf<Complete>().toHaveProperty('sortByCount');
  expectTypeOf<Complete>().toHaveProperty('sample');
  expectTypeOf<Complete>().toHaveProperty('redact');
  expectTypeOf<Complete>().toHaveProperty('out');
  expectTypeOf<Complete>().toHaveProperty('unionWith');
  expectTypeOf<Complete>().toHaveProperty('bucket');
  expectTypeOf<Complete>().toHaveProperty('bucketAuto');
  expectTypeOf<Complete>().toHaveProperty('geoNear');
  expectTypeOf<Complete>().toHaveProperty('facet');
  expectTypeOf<Complete>().toHaveProperty('graphLookup');
  expectTypeOf<Complete>().toHaveProperty('merge');
  expectTypeOf<Complete>().toHaveProperty('setWindowFields');
  expectTypeOf<Complete>().toHaveProperty('densify');
  expectTypeOf<Complete>().toHaveProperty('fill');
  expectTypeOf<Complete>().toHaveProperty('search');
  expectTypeOf<Complete>().toHaveProperty('searchMeta');
  expectTypeOf<Complete>().toHaveProperty('vectorSearch');

  // @ts-expect-error - missing 'match' method (and all new stage methods)
  assertType<MongoStageVisitor<string>>({
    project: () => '',
    sort: () => '',
    limit: () => '',
    skip: () => '',
    lookup: () => '',
    unwind: () => '',
    group: () => '',
    addFields: () => '',
    replaceRoot: () => '',
    count: () => '',
    sortByCount: () => '',
    sample: () => '',
    redact: () => '',
  });
});

test('MongoGroupStage.accumulators requires MongoAggAccumulator values', () => {
  expectTypeOf<MongoGroupStage['accumulators']>().toEqualTypeOf<
    Readonly<Record<string, MongoAggAccumulator>>
  >();
});

test('MongoProjectionValue allows 0, 1, or MongoAggExpr', () => {
  expectTypeOf<0>().toExtend<MongoProjectionValue>();
  expectTypeOf<1>().toExtend<MongoProjectionValue>();
  expectTypeOf<MongoAggExpr>().toExtend<MongoProjectionValue>();

  // @ts-expect-error - 2 is not a valid projection value
  assertType<MongoProjectionValue>(2);

  // @ts-expect-error - string is not a valid projection value
  assertType<MongoProjectionValue>('include');
});

test('accept returns R for any visitor R', () => {
  const stage = {} as unknown as MongoMatchStage;
  const visitor: MongoStageVisitor<number> = {
    match: () => 1,
    project: () => 2,
    sort: () => 3,
    limit: () => 4,
    skip: () => 5,
    lookup: () => 6,
    unwind: () => 7,
    group: () => 8,
    addFields: () => 9,
    replaceRoot: () => 10,
    count: () => 11,
    sortByCount: () => 12,
    sample: () => 13,
    redact: () => 14,
    out: () => 15,
    unionWith: () => 16,
    bucket: () => 17,
    bucketAuto: () => 18,
    geoNear: () => 19,
    facet: () => 20,
    graphLookup: () => 21,
    merge: () => 22,
    setWindowFields: () => 23,
    densify: () => 24,
    fill: () => 25,
    search: () => 26,
    searchMeta: () => 27,
    vectorSearch: () => 28,
  };
  expectTypeOf(stage.accept(visitor)).toBeNumber();
});

test('raw objects are not assignable to MongoPipelineStage', () => {
  // @ts-expect-error - raw objects are not valid pipeline stages
  assertType<MongoPipelineStage>({ $match: { status: 'active' } });
});
