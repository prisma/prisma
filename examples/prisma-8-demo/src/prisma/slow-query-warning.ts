/**
 * Custom middleware example: warn when a query runs longer than a threshold.
 *
 * `afterExecute` fires once per `query()` call after the rows have been
 * consumed — whether they came from the driver or from an `intercept` hit
 * (`result.source` says which) — with the observed `latencyMs` and
 * `rowCount` for the run. Registered on the runtime in `src/prisma/db.ts`
 * via the `middleware: [...]` option.
 */
import type { SqlMiddleware } from '@prisma/orm-postgres/family-runtime';

export interface SlowQueryWarningOptions {
  /** Latency above this many milliseconds logs a warning. Default: 250. */
  readonly thresholdMs?: number;
}

export function slowQueryWarning(options?: SlowQueryWarningOptions): SqlMiddleware {
  const thresholdMs = options?.thresholdMs ?? 250;

  return {
    name: 'slow-query-warning',
    familyId: 'sql',

    async afterExecute(plan, result, ctx) {
      if (result.operation !== 'query' || result.latencyMs <= thresholdMs) return;
      ctx.log.warn({
        code: 'APP.SLOW_QUERY',
        message: `Query took ${result.latencyMs}ms (threshold: ${thresholdMs}ms)`,
        details: {
          sql: plan.sql,
          rowCount: result.rowCount,
          latencyMs: result.latencyMs,
          source: result.source,
          planExecutionId: ctx.planExecutionId,
        },
      });
    },
  };
}
