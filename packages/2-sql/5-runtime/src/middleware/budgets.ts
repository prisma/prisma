import {
  type AfterExecuteResult,
  type AfterQueryResult,
  type RuntimeErrorEnvelope,
  runtimeError,
} from '@internal/framework-components/runtime';
import { isQueryAst, type SelectAst } from '@internal/sql-relational-core/ast';
import type { SqlExecutionPlan } from '@internal/sql-relational-core/plan';
import { assertNever } from '@internal/utils/internal-error';
import type { SqlMiddleware, SqlMiddlewareContext } from './sql-middleware';

export interface BudgetsOptions {
  readonly maxRows?: number;
  readonly defaultTableRows?: number;
  readonly tableRows?: Record<string, number>;
  readonly maxLatencyMs?: number;
  readonly severities?: {
    readonly rowCount?: 'warn' | 'error';
    readonly latency?: 'warn' | 'error';
  };
}

function hasAggregateWithoutGroupBy(ast: SelectAst): boolean {
  if (ast.groupBy !== undefined) {
    return false;
  }
  return ast.projection.some((item) => item.expr.kind === 'aggregate');
}

function primaryTableFromAst(ast: SelectAst): string | undefined {
  if (ast.from === undefined) return undefined;
  switch (ast.from.kind) {
    case 'table-source':
      return ast.from.name;
    case 'derived-table-source':
      return ast.from.alias;
    case 'function-source':
      return ast.from.fn;
    // v8 ignore next 4
    default:
      return assertNever(
        ast.from,
        `Unsupported source kind: ${(ast.from satisfies never as { kind: string }).kind}`,
      );
  }
}

function estimateRowsFromAst(
  ast: SelectAst,
  tableRows: Record<string, number>,
  defaultTableRows: number,
  hasAggregateWithoutGroup: boolean,
): number {
  if (hasAggregateWithoutGroup) {
    return 1;
  }

  const primaryTable = primaryTableFromAst(ast);
  const tableEstimate =
    (primaryTable !== undefined ? tableRows[primaryTable] : undefined) ?? defaultTableRows;

  if (typeof ast.limit === 'number') {
    return Math.min(ast.limit, tableEstimate);
  }

  // Expression-form limit: value is dynamic at execute time (e.g. a prepared
  // bind site). Treat as bounded but unknown — the table estimate is the
  // worst case.
  return tableEstimate;
}

function emitBudgetViolation(
  error: RuntimeErrorEnvelope,
  shouldBlock: boolean,
  ctx: SqlMiddlewareContext,
): void {
  if (shouldBlock) {
    throw error;
  }
  ctx.log.warn({
    code: error.code,
    message: error.message,
    details: error.details,
  });
}

export function budgets(options?: BudgetsOptions): SqlMiddleware {
  const maxRows = options?.maxRows ?? 10_000;
  const defaultTableRows = options?.defaultTableRows ?? 10_000;
  const tableRows = options?.tableRows ?? {};
  const maxLatencyMs = options?.maxLatencyMs ?? 1_000;
  const rowSeverity = options?.severities?.rowCount ?? 'error';
  const latencySeverity = options?.severities?.latency ?? 'warn';

  const observedRowsByPlan = new WeakMap<SqlExecutionPlan, { count: number }>();

  const beforeOperation = async (
    plan: SqlExecutionPlan,
    ctx: SqlMiddlewareContext,
  ): Promise<void> => {
    observedRowsByPlan.set(plan, { count: 0 });

    if (isQueryAst(plan.ast) && plan.ast.kind === 'select') {
      evaluateSelectAst(plan.ast, ctx);
    }
  };

  const afterOperation = async (
    _plan: SqlExecutionPlan,
    result: AfterQueryResult | AfterExecuteResult,
    ctx: SqlMiddlewareContext,
  ): Promise<void> => {
    const latencyMs = result.latencyMs;
    if (latencyMs > maxLatencyMs) {
      const shouldBlock = latencySeverity === 'error' || ctx.mode === 'strict';
      emitBudgetViolation(
        runtimeError('BUDGET.TIME_EXCEEDED', 'Query latency exceeds budget', {
          latencyMs,
          maxLatencyMs,
        }),
        shouldBlock,
        ctx,
      );
    }
  };

  return Object.freeze({
    name: 'budgets',
    familyId: 'sql' as const,
    beforeQuery: beforeOperation,
    beforeExecute: beforeOperation,

    async onRow(_row: Record<string, unknown>, plan: SqlExecutionPlan, _ctx: SqlMiddlewareContext) {
      const state = observedRowsByPlan.get(plan);
      if (!state) return;
      state.count += 1;
      if (state.count > maxRows) {
        throw runtimeError('BUDGET.ROWS_EXCEEDED', 'Observed row count exceeds budget', {
          source: 'observed',
          observedRows: state.count,
          maxRows,
        });
      }
    },

    afterQuery: afterOperation,
    afterExecute: afterOperation,
  });

  function evaluateSelectAst(ast: SelectAst, ctx: SqlMiddlewareContext) {
    const hasAggNoGroup = hasAggregateWithoutGroupBy(ast);
    const estimated = estimateRowsFromAst(ast, tableRows, defaultTableRows, hasAggNoGroup);
    const isUnbounded = ast.limit === undefined && !hasAggNoGroup;
    const shouldBlock = rowSeverity === 'error' || ctx.mode === 'strict';

    if (isUnbounded) {
      const details =
        estimated >= maxRows
          ? { source: 'ast', estimatedRows: estimated, maxRows }
          : { source: 'ast', maxRows };
      emitBudgetViolation(
        runtimeError('BUDGET.ROWS_EXCEEDED', 'Unbounded SELECT query exceeds budget', details),
        shouldBlock,
        ctx,
      );
      return;
    }

    if (estimated > maxRows) {
      emitBudgetViolation(
        runtimeError('BUDGET.ROWS_EXCEEDED', 'Estimated row count exceeds budget', {
          source: 'ast',
          estimatedRows: estimated,
          maxRows,
        }),
        shouldBlock,
        ctx,
      );
    }
  }
}
