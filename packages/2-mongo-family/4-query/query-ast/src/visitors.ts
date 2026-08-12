import type {
  MongoAggAccumulator,
  MongoAggArrayFilter,
  MongoAggCond,
  MongoAggExpr,
  MongoAggFieldRef,
  MongoAggLet,
  MongoAggLiteral,
  MongoAggMap,
  MongoAggMergeObjects,
  MongoAggOperator,
  MongoAggReduce,
  MongoAggSwitch,
} from './aggregation-expressions';
import type {
  MongoAndExpr,
  MongoExistsExpr,
  MongoExprFilter,
  MongoFieldFilter,
  MongoFilterExpr,
  MongoNotExpr,
  MongoOrExpr,
} from './filter-expressions';
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
} from './stages';

export interface MongoAggExprVisitor<R> {
  fieldRef(expr: MongoAggFieldRef): R;
  literal(expr: MongoAggLiteral): R;
  operator(expr: MongoAggOperator): R;
  accumulator(expr: MongoAggAccumulator): R;
  cond(expr: MongoAggCond): R;
  switch_(expr: MongoAggSwitch): R;
  filter(expr: MongoAggArrayFilter): R;
  map(expr: MongoAggMap): R;
  reduce(expr: MongoAggReduce): R;
  let_(expr: MongoAggLet): R;
  mergeObjects(expr: MongoAggMergeObjects): R;
}

export interface MongoAggExprRewriter {
  fieldRef?(expr: MongoAggFieldRef): MongoAggExpr;
  literal?(expr: MongoAggLiteral): MongoAggExpr;
  operator?(expr: MongoAggOperator): MongoAggExpr;
  accumulator?(expr: MongoAggAccumulator): MongoAggExpr;
  cond?(expr: MongoAggCond): MongoAggExpr;
  switch_?(expr: MongoAggSwitch): MongoAggExpr;
  filter?(expr: MongoAggArrayFilter): MongoAggExpr;
  map?(expr: MongoAggMap): MongoAggExpr;
  reduce?(expr: MongoAggReduce): MongoAggExpr;
  let_?(expr: MongoAggLet): MongoAggExpr;
  mergeObjects?(expr: MongoAggMergeObjects): MongoAggExpr;
}

export interface MongoFilterVisitor<R> {
  field(expr: MongoFieldFilter): R;
  and(expr: MongoAndExpr): R;
  or(expr: MongoOrExpr): R;
  not(expr: MongoNotExpr): R;
  exists(expr: MongoExistsExpr): R;
  expr(expr: MongoExprFilter): R;
}

export interface MongoFilterRewriter {
  field?(expr: MongoFieldFilter): MongoFilterExpr;
  and?(expr: MongoAndExpr): MongoFilterExpr;
  or?(expr: MongoOrExpr): MongoFilterExpr;
  not?(expr: MongoNotExpr): MongoFilterExpr;
  exists?(expr: MongoExistsExpr): MongoFilterExpr;
  expr?(expr: MongoExprFilter): MongoFilterExpr;
}

export interface MongoStageRewriterContext {
  filter?: MongoFilterRewriter;
  aggExpr?: MongoAggExprRewriter;
}

export interface MongoStageVisitor<R> {
  match(stage: MongoMatchStage): R;
  project(stage: MongoProjectStage): R;
  sort(stage: MongoSortStage): R;
  limit(stage: MongoLimitStage): R;
  skip(stage: MongoSkipStage): R;
  lookup(stage: MongoLookupStage): R;
  unwind(stage: MongoUnwindStage): R;
  group(stage: MongoGroupStage): R;
  addFields(stage: MongoAddFieldsStage): R;
  replaceRoot(stage: MongoReplaceRootStage): R;
  count(stage: MongoCountStage): R;
  sortByCount(stage: MongoSortByCountStage): R;
  sample(stage: MongoSampleStage): R;
  redact(stage: MongoRedactStage): R;
  out(stage: MongoOutStage): R;
  unionWith(stage: MongoUnionWithStage): R;
  bucket(stage: MongoBucketStage): R;
  bucketAuto(stage: MongoBucketAutoStage): R;
  geoNear(stage: MongoGeoNearStage): R;
  facet(stage: MongoFacetStage): R;
  graphLookup(stage: MongoGraphLookupStage): R;
  merge(stage: MongoMergeStage): R;
  setWindowFields(stage: MongoSetWindowFieldsStage): R;
  densify(stage: MongoDensifyStage): R;
  fill(stage: MongoFillStage): R;
  search(stage: MongoSearchStage): R;
  searchMeta(stage: MongoSearchMetaStage): R;
  vectorSearch(stage: MongoVectorSearchStage): R;
}
