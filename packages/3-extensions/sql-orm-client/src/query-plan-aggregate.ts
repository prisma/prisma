import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import {
  type AggregateExpr,
  AndExpr,
  type AnyExpression,
  BinaryExpr,
  type CodecRef,
  ColumnRef,
  LiteralExpr,
  NotExpr,
  NullCheckExpr,
  type OrderByItem,
  OrExpr,
  ProjectionItem,
  SelectAst,
} from '@internal/sql-relational-core/ast';
import { codecRefForStorageColumn } from '@internal/sql-relational-core/codec-descriptor-registry';
import type { SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type { SqlAggregateDescriptorRegistry } from '@internal/sql-relational-core/query-lane-context';
import { plainAggregateExpr, resolveAggregate } from './aggregate-codecs';
import { assertDistinctOnCapability, resolvePolymorphismInfo } from './collection-contract';
import { ormError } from './orm-errors';
import { buildOrmQueryPlan, deriveParamsFromAst } from './query-plan-meta';
import { buildMtiJoins, buildScopedSource, buildStateWhere } from './query-plan-scope';
import { tableSourceForContract } from './storage-resolution';
import type { AggregateSelector, CollectionState } from './types';
import { combineWhereExprs } from './where-utils';

function toAggregateProjection(
  contract: Contract<SqlStorage>,
  aggregates: SqlAggregateDescriptorRegistry,
  namespaceId: string,
  tableName: string,
  selector: AggregateSelector<unknown>,
): { expr: AnyExpression; codec: CodecRef | undefined } {
  // The result's codec is the target's to declare: `count` is a wide integer,
  // `sum` widens or preserves per input, and `min`/`max` keep the column's own
  // codec — all of which the aggregate registry answers per operation and input.
  // Whether an operation answers a call without an input is equally the
  // descriptor's to declare: a selector with no column resolves through the
  // no-input rung and fails there when the target declares none. A target that
  // also needs the result rendered a particular way says so with a lowering,
  // which builds the expression in place of the plain call.
  const {
    codec,
    input: inputCodec,
    lower,
  } = resolveAggregate({
    aggregates,
    contract,
    namespaceId,
    tableName,
    fn: selector.fn,
    column: selector.column,
  });

  const inputExpr =
    selector.column === undefined ? undefined : ColumnRef.of(tableName, selector.column);
  const expr =
    lower !== undefined
      ? lower({ expr: inputExpr, inputCodec })
      : plainAggregateExpr(selector.fn, inputExpr);

  return { expr, codec };
}

// ORM HAVING filters use literal binding (values inlined at plan-build time),
// not parameterized binding. ParamRef is rejected because the ORM's grouped
// collection API always produces literal comparisons for having() predicates.
function validateGroupedComparable(value: AnyExpression): AnyExpression {
  switch (value.kind) {
    case 'param-ref':
      throw ormError(
        'ORM.HAVING_EXPRESSION_UNSUPPORTED',
        'ParamRef is not supported in grouped having expressions',
        { meta: { kind: value.kind } },
      );
    case 'literal':
    case 'column-ref':
    case 'identifier-ref':
    case 'aggregate':
    case 'operation':
      return value;
    case 'function-call':
    case 'cast':
    case 'case':
      throw ormError(
        'ORM.HAVING_EXPRESSION_UNSUPPORTED',
        `Unsupported comparable kind in grouped having: "${value.kind}"`,
        { meta: { kind: value.kind } },
      );
    case 'list':
      if (value.values.some((entry) => entry.kind === 'param-ref')) {
        throw ormError(
          'ORM.HAVING_EXPRESSION_UNSUPPORTED',
          'ParamRef is not supported in grouped having expressions',
          { meta: { kind: 'list' } },
        );
      }
      return value;
    default:
      throw ormError(
        'ORM.HAVING_EXPRESSION_UNSUPPORTED',
        `Unsupported comparable kind in grouped having: "${value.kind}"`,
        { meta: { kind: value.kind } },
      );
  }
}

function validateGroupedMetricExpr(expr: AnyExpression): AggregateExpr {
  if (expr.kind !== 'aggregate') {
    throw ormError(
      'ORM.HAVING_EXPRESSION_UNSUPPORTED',
      'groupBy().having() only supports aggregate metric expressions',
      { meta: { kind: expr.kind } },
    );
  }

  return expr;
}

function rejectHavingExpr(expr: { kind: string }): never {
  throw ormError(
    'ORM.HAVING_EXPRESSION_UNSUPPORTED',
    `Unsupported grouped having expression kind "${expr.kind}"`,
    { meta: { kind: expr.kind } },
  );
}

function validateGroupedHavingExpr(expr: AnyExpression): AnyExpression {
  return expr.accept<AnyExpression>({
    columnRef: rejectHavingExpr,
    identifierRef: rejectHavingExpr,
    subquery: rejectHavingExpr,
    operation: rejectHavingExpr,
    aggregate: rejectHavingExpr,
    windowFunc: rejectHavingExpr,
    functionCall: rejectHavingExpr,
    cast: rejectHavingExpr,
    case: rejectHavingExpr,
    jsonObject: rejectHavingExpr,
    jsonArrayAgg: rejectHavingExpr,
    literal: rejectHavingExpr,
    param() {
      throw ormError(
        'ORM.HAVING_EXPRESSION_UNSUPPORTED',
        'ParamRef is not supported in grouped having expressions',
        { meta: { kind: 'param-ref' } },
      );
    },
    preparedParam() {
      throw ormError(
        'ORM.HAVING_EXPRESSION_UNSUPPORTED',
        'PreparedParamRef is not supported in grouped having expressions',
        { meta: { kind: 'prepared-param-ref' } },
      );
    },
    list: rejectHavingExpr,
    and(expr) {
      return AndExpr.of(expr.exprs.map((child) => validateGroupedHavingExpr(child)));
    },
    or(expr) {
      return OrExpr.of(expr.exprs.map((child) => validateGroupedHavingExpr(child)));
    },
    exists: rejectHavingExpr,
    nullCheck(expr) {
      return new NullCheckExpr(validateGroupedMetricExpr(expr.expr), expr.isNull);
    },
    not(expr) {
      return new NotExpr(validateGroupedHavingExpr(expr.expr));
    },
    binary(expr) {
      return new BinaryExpr(
        expr.op,
        validateGroupedMetricExpr(expr.left),
        validateGroupedComparable(expr.right),
      );
    },
    rawExpr: rejectHavingExpr,
  });
}

// `__row` is exclusive, not additive: only used when no selector names a column.
function scopedInnerProjection(
  tableName: string,
  entries: ReadonlyArray<[string, AggregateSelector<unknown>]>,
  orderBy: ReadonlyArray<OrderByItem> | undefined,
): ProjectionItem[] {
  const columns = new Set<string>();
  for (const [, selector] of entries) {
    if (selector.column !== undefined) {
      columns.add(selector.column);
    }
  }
  // A column `orderBy` names has to be visible through the scope wrap
  // too, even when no selector aggregates it — the wrap is the only
  // place the (possibly ranked/deduped) row set exists, so an unrooted
  // reference to it downstream would resolve against nothing.
  for (const item of orderBy ?? []) {
    if (item.expr.kind === 'column-ref') {
      columns.add(item.expr.column);
    }
  }

  if (columns.size === 0) {
    return [ProjectionItem.of('__row', LiteralExpr.of(1))];
  }

  return Array.from(columns, (column) =>
    ProjectionItem.of(column, ColumnRef.of(tableName, column)),
  );
}

export function compileAggregate(
  contract: Contract<SqlStorage>,
  aggregates: SqlAggregateDescriptorRegistry,
  namespaceId: string,
  tableName: string,
  state: CollectionState,
  aggregateSpec: Record<string, AggregateSelector<unknown>>,
  modelName?: string,
): SqlQueryPlan<Record<string, unknown>> {
  const entries = Object.entries(aggregateSpec);
  if (entries.length === 0) {
    throw ormError(
      'ORM.AGGREGATE_SELECTOR_MISSING',
      'aggregate() requires at least one aggregation selector',
      { meta: { method: 'aggregate', namespaceId, tableName } },
    );
  }

  if (state.distinctOn !== undefined && state.distinctOn.length > 0) {
    assertDistinctOnCapability(contract, 'distinctOn');
  }

  const hasPagination = state.limit !== undefined || state.offset !== undefined;
  const hasDistinct =
    (state.distinct !== undefined && state.distinct.length > 0) ||
    (state.distinctOn !== undefined && state.distinctOn.length > 0);
  const needsRowScope = hasPagination || hasDistinct;

  if (needsRowScope) {
    const { source } = buildScopedSource(
      contract,
      namespaceId,
      tableName,
      state,
      modelName,
      scopedInnerProjection(tableName, entries, state.orderBy),
    );
    const projection: ProjectionItem[] = entries.map(([alias, selector]) => {
      const { expr, codec } = toAggregateProjection(
        contract,
        aggregates,
        namespaceId,
        tableName,
        selector,
      );
      return ProjectionItem.of(alias, expr, codec);
    });
    const ast = SelectAst.from(source).withProjection(projection);

    const { params } = deriveParamsFromAst(ast);
    return buildOrmQueryPlan(contract, ast, params);
  }

  const polyInfo = modelName
    ? resolvePolymorphismInfo(contract, namespaceId, modelName)
    : undefined;
  const variantJoins =
    polyInfo && polyInfo.mtiVariants.length > 0
      ? buildMtiJoins(contract, namespaceId, polyInfo, state.variantName, undefined).joins
      : [];
  const where = buildStateWhere(contract, tableName, state, { namespaceId });

  const projection: ProjectionItem[] = entries.map(([alias, selector]) => {
    const { expr, codec } = toAggregateProjection(
      contract,
      aggregates,
      namespaceId,
      tableName,
      selector,
    );
    return ProjectionItem.of(alias, expr, codec);
  });
  let ast = SelectAst.from(tableSourceForContract(contract, namespaceId, tableName)).withProjection(
    projection,
  );
  if (variantJoins.length > 0) {
    ast = ast.withJoins(variantJoins);
  }
  if (where) {
    ast = ast.withWhere(where);
  }

  const { params } = deriveParamsFromAst(ast);
  return buildOrmQueryPlan(contract, ast, params);
}

export function compileGroupedAggregate(
  contract: Contract<SqlStorage>,
  aggregates: SqlAggregateDescriptorRegistry,
  namespaceId: string,
  tableName: string,
  filters: readonly AnyExpression[],
  groupByColumns: readonly string[],
  aggregateSpec: Record<string, AggregateSelector<unknown>>,
  havingExpr: AnyExpression | undefined,
): SqlQueryPlan<Record<string, unknown>> {
  if (groupByColumns.length === 0) {
    throw ormError('ORM.GROUP_BY_FIELD_MISSING', 'groupBy() requires at least one field', {
      meta: { namespaceId, tableName },
    });
  }

  const entries = Object.entries(aggregateSpec);
  if (entries.length === 0) {
    throw ormError(
      'ORM.AGGREGATE_SELECTOR_MISSING',
      'groupBy().aggregate() requires at least one aggregation selector',
      { meta: { method: 'groupBy.aggregate', namespaceId, tableName } },
    );
  }

  const projection: ProjectionItem[] = [
    ...groupByColumns.map((column) =>
      ProjectionItem.of(
        column,
        ColumnRef.of(tableName, column),
        codecRefForStorageColumn(contract.storage, namespaceId, tableName, column),
      ),
    ),
    ...entries.map(([alias, selector]) => {
      const { expr, codec } = toAggregateProjection(
        contract,
        aggregates,
        namespaceId,
        tableName,
        selector,
      );
      return ProjectionItem.of(alias, expr, codec);
    }),
  ];

  let ast = SelectAst.from(tableSourceForContract(contract, namespaceId, tableName))
    .withProjection(projection)
    .withGroupBy(groupByColumns.map((column) => ColumnRef.of(tableName, column)));
  const where = combineWhereExprs(filters);
  if (where) {
    ast = ast.withWhere(where);
  }

  if (havingExpr) {
    ast = ast.withHaving(validateGroupedHavingExpr(havingExpr));
  }

  const { params } = deriveParamsFromAst(ast);
  return buildOrmQueryPlan(contract, ast, params);
}
