import type { Contract } from '@internal/contract/types';
import type { SqlStorage } from '@internal/sql-contract/types';
import {
  AndExpr,
  type AnyExpression,
  type AstRewriter,
  BinaryExpr,
  type BinaryOp,
  ColumnRef,
  DerivedTableSource,
  EqColJoinOn,
  LiteralExpr,
  OrderByItem,
  OrExpr,
  ProjectionItem,
  SelectAst,
  TableSource,
  WindowFuncExpr,
} from '@internal/sql-relational-core/ast';
import { assertDefined } from '@internal/utils/assertions';
import { ormError } from './orm-errors';
import type { CollectionState } from './types';
import { bindWhereExpr } from './where-binding';
import { combineWhereExprs } from './where-utils';

type CursorOrderEntry = {
  readonly column: string;
  readonly direction: 'asc' | 'desc';
  readonly value: unknown;
};

function createBoundaryExpr(tableName: string, entry: CursorOrderEntry): AnyExpression {
  const comparator: BinaryOp = entry.direction === 'asc' ? 'gt' : 'lt';
  return new BinaryExpr(
    comparator,
    ColumnRef.of(tableName, entry.column),
    LiteralExpr.of(entry.value),
  );
}

function buildLexicographicCursorWhere(
  tableName: string,
  entries: readonly CursorOrderEntry[],
): AnyExpression {
  const branches = entries.map((entry, index): AnyExpression => {
    const branchExprs: AnyExpression[] = [];

    for (const prefixEntry of entries.slice(0, index)) {
      branchExprs.push(
        BinaryExpr.eq(
          ColumnRef.of(tableName, prefixEntry.column),
          LiteralExpr.of(prefixEntry.value),
        ),
      );
    }

    branchExprs.push(createBoundaryExpr(tableName, entry));
    if (branchExprs.length === 1) {
      const branch = branchExprs[0];
      assertDefined(branch, 'cursor branch contains its boundary expression');
      return branch;
    }

    return AndExpr.of(branchExprs);
  });

  if (branches.length === 1) {
    const branch = branches[0];
    assertDefined(branch, 'cursor expression contains its single branch');
    return branch;
  }

  return OrExpr.of(branches);
}

function buildCursorWhere(
  tableName: string,
  orderBy: readonly OrderByItem[] | undefined,
  cursor: Readonly<Record<string, unknown>> | undefined,
): AnyExpression | undefined {
  if (!cursor || !orderBy || orderBy.length === 0) {
    return undefined;
  }

  const entries: CursorOrderEntry[] = [];
  for (const order of orderBy) {
    if (order.expr.kind !== 'column-ref') continue;
    const column = order.expr.column;
    const value = cursor[column];
    if (value === undefined) {
      throw ormError(
        'ORM.CURSOR_VALUE_MISSING',
        `Missing cursor value for orderBy column "${column}"`,
        {
          meta: { column },
        },
      );
    }
    entries.push({
      column,
      direction: order.dir,
      value,
    });
  }

  const firstEntry = entries[0];
  if (entries.length === 1 && firstEntry !== undefined) {
    return createBoundaryExpr(tableName, firstEntry);
  }

  return buildLexicographicCursorWhere(tableName, entries);
}

function createTableRefRemapper(fromTable: string, toTable: string): AstRewriter {
  return {
    columnRef: (col) => (col.table === fromTable ? ColumnRef.of(toTable, col.column) : col),
    tableSource: (source) => {
      if (source.alias === fromTable) {
        return TableSource.named(source.name, toTable, source.namespaceId);
      }
      if (!source.alias && source.name === fromTable) {
        return TableSource.named(source.name, toTable, source.namespaceId);
      }
      return source;
    },
    eqColJoinOn: (on) =>
      EqColJoinOn.of(
        on.left.table === fromTable ? ColumnRef.of(toTable, on.left.column) : on.left,
        on.right.table === fromTable ? ColumnRef.of(toTable, on.right.column) : on.right,
      ),
  };
}

function buildStateWhere(
  contract: Contract<SqlStorage>,
  tableName: string,
  state: CollectionState,
  options?: {
    readonly filterTableName?: string;
    readonly namespaceId?: string | undefined;
  },
): AnyExpression | undefined {
  const filterTableName = options?.filterTableName;
  const cursorTableName = filterTableName ?? tableName;
  const cursorWhere = buildCursorWhere(cursorTableName, state.orderBy, state.cursor);
  const boundFilters = state.filters.map((filter) =>
    bindWhereExpr(contract, filter, options?.namespaceId),
  );
  const remappedFilters =
    filterTableName && filterTableName !== tableName
      ? boundFilters.map((filter) =>
          filter.rewrite(createTableRefRemapper(filterTableName, tableName)),
        )
      : boundFilters;
  const boundCursorWhere = cursorWhere
    ? bindWhereExpr(contract, cursorWhere, options?.namespaceId)
    : undefined;
  const remappedCursorWhere =
    boundCursorWhere && filterTableName && filterTableName !== tableName
      ? boundCursorWhere.rewrite(createTableRefRemapper(filterTableName, tableName))
      : boundCursorWhere;
  const filters = remappedCursorWhere ? [...remappedFilters, remappedCursorWhere] : remappedFilters;
  return combineWhereExprs(filters);
}

/**
 * Wrap a base SELECT in a `ROW_NUMBER() OVER (PARTITION BY … ORDER BY …) = 1`
 * filter, implementing Prisma-style `.distinct(cols)` semantics: one
 * representative row per `(distinctColumnRefs)` group is kept; the rest
 * are dropped.
 *
 * Picking which row survives in each partition is governed by
 * `rankingOrderBy`. When the caller's `orderBy` doesn't fully order rows
 * within a partition (e.g. user wrote `.distinct('title')` with no
 * `orderBy`, or ties in their ordering), the choice is
 * implementation-defined — matching Prisma's documented nested-distinct
 * behaviour. Callers that want determinism should pass an `orderBy` that
 * is total within each partition.
 *
 * The wrapper forwards every column of `base.projection` through the
 * derived alias, so the wrapper's projection is byte-identical in alias
 * names — making this transparent to any outer query (`json_agg`,
 * correlated subquery, top-level SELECT) that consumes the SELECT.
 */
function wrapWithRowNumberDedup(options: {
  readonly base: SelectAst;
  readonly distinctColumnRefs: ReadonlyArray<AnyExpression>;
  readonly rankingOrderBy: ReadonlyArray<OrderByItem>;
  readonly rankedAlias: string;
}): SelectAst {
  const { base, distinctColumnRefs, rankingOrderBy, rankedAlias } = options;
  const rnAlias = '__prisma_distinct_rn';
  // SQLite requires an ORDER BY inside the window spec for ranking
  // functions; Postgres allows omitting it but the result is
  // unspecified. Default to ordering by the partition columns so the
  // emitted SQL is portable AND deterministic-modulo-distinct-cols
  // (which is the natural choice when the caller didn't specify).
  const effectiveOrderBy =
    rankingOrderBy.length > 0
      ? rankingOrderBy
      : distinctColumnRefs.map((expr) => OrderByItem.asc(expr));

  const inner = base.withProjection([
    ...base.projection,
    ProjectionItem.of(
      rnAlias,
      WindowFuncExpr.rowNumber({
        partitionBy: distinctColumnRefs,
        orderBy: effectiveOrderBy,
      }),
    ),
  ]);

  return SelectAst.from(DerivedTableSource.as(rankedAlias, inner))
    .withProjection(
      base.projection.map((item) =>
        ProjectionItem.of(item.alias, ColumnRef.of(rankedAlias, item.alias), item.codec),
      ),
    )
    .withWhere(BinaryExpr.eq(ColumnRef.of(rankedAlias, rnAlias), LiteralExpr.of(1)));
}

export { buildStateWhere, createTableRefRemapper, wrapWithRowNumberDedup };
