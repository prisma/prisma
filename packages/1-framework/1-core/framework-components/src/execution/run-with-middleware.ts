import { AsyncIterableResult } from './async-iterable-result';
import type { ExecutionPlan } from './query-plan';
import { runtimeError } from './runtime-error';
import type {
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeStatementStats,
} from './runtime-middleware';

/**
 * Runs the middleware intercept, row-source, on-row, and completion lifecycle
 * for a caller-selected query operation. `beforeExecute` remains owned by the
 * family runtime because SQL must run it before parameter encoding.
 */
export function runWithMiddleware<TExec extends ExecutionPlan, Row>(
  exec: TExec,
  middleware: ReadonlyArray<RuntimeMiddleware<TExec>>,
  ctx: RuntimeMiddlewareContext,
  runDriver: () => AsyncIterable<Row>,
): AsyncIterableResult<Row> {
  const iterator = async function* (): AsyncGenerator<Row, void, unknown> {
    const startedAt = Date.now();
    let rowCount = 0;
    let completed = false;
    let source: 'driver' | 'middleware' = 'driver';
    let rowSource: AsyncIterable<Row> | Iterable<Row> | undefined;

    try {
      for (const mw of middleware) {
        if (!mw.intercept) continue;
        source = 'middleware';
        const result = await mw.intercept(exec, ctx);
        if (result === undefined) {
          source = 'driver';
          continue;
        }
        if (result.operation !== 'query') {
          throw middlewareResultMismatch('query', result.operation);
        }
        ctx.log.debug?.({ event: 'middleware.intercept', middleware: mw.name });
        rowSource = result.rows as unknown as AsyncIterable<Row> | Iterable<Row>;
        break;
      }

      if (source === 'driver') rowSource = runDriver();

      for await (const row of rowSource as AsyncIterable<Row> | Iterable<Row>) {
        if (source === 'driver') {
          for (const mw of middleware) {
            if (mw.onRow) {
              await mw.onRow(row as Record<string, unknown>, exec, ctx);
            }
          }
        }
        rowCount++;
        yield row;
      }

      completed = true;
    } catch (error) {
      await notifyQueryCompletion(
        middleware,
        exec,
        ctx,
        { rowCount, latencyMs: Date.now() - startedAt, completed, source },
        true,
      );
      throw error;
    }

    await notifyQueryCompletion(
      middleware,
      exec,
      ctx,
      { rowCount, latencyMs: Date.now() - startedAt, completed, source },
      false,
    );
  };

  return new AsyncIterableResult(iterator());
}

/** Runs the same intercept and completion lifecycle for statement statistics. */
export async function runExecuteWithMiddleware<TExec extends ExecutionPlan>(
  exec: TExec,
  middleware: ReadonlyArray<RuntimeMiddleware<TExec>>,
  ctx: RuntimeMiddlewareContext,
  runDriver: () => Promise<RuntimeStatementStats>,
): Promise<RuntimeStatementStats> {
  const startedAt = Date.now();
  let source: 'driver' | 'middleware' = 'driver';
  let stats: RuntimeStatementStats;

  try {
    let interceptedStats: RuntimeStatementStats | undefined;
    for (const mw of middleware) {
      if (!mw.intercept) continue;
      source = 'middleware';
      const result = await mw.intercept(exec, ctx);
      if (result === undefined) {
        source = 'driver';
        continue;
      }
      if (result.operation !== 'execute') {
        throw middlewareResultMismatch('execute', result.operation);
      }
      ctx.log.debug?.({ event: 'middleware.intercept', middleware: mw.name });
      interceptedStats = result.stats;
      break;
    }

    stats = source === 'driver' ? await runDriver() : requireStats(interceptedStats);
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    for (const mw of middleware) {
      if (mw.afterExecute) {
        try {
          await mw.afterExecute(
            exec,
            { operation: 'execute', latencyMs, completed: false, source },
            ctx,
          );
        } catch {
          // Preserve the execution error when cleanup observers also fail.
        }
      }
    }
    throw error;
  }

  const latencyMs = Date.now() - startedAt;
  for (const mw of middleware) {
    if (mw.afterExecute) {
      await mw.afterExecute(
        exec,
        { operation: 'execute', stats, latencyMs, completed: true, source },
        ctx,
      );
    }
  }
  return stats;
}

async function notifyQueryCompletion<TExec extends ExecutionPlan>(
  middleware: ReadonlyArray<RuntimeMiddleware<TExec>>,
  exec: TExec,
  ctx: RuntimeMiddlewareContext,
  result: {
    readonly rowCount: number;
    readonly latencyMs: number;
    readonly completed: boolean;
    readonly source: 'driver' | 'middleware';
  },
  swallowErrors: boolean,
): Promise<void> {
  for (const mw of middleware) {
    if (!mw.afterExecute) continue;
    if (swallowErrors) {
      try {
        await mw.afterExecute(exec, { operation: 'query', ...result }, ctx);
      } catch {
        // Preserve the query error when cleanup observers also fail.
      }
    } else {
      await mw.afterExecute(exec, { operation: 'query', ...result }, ctx);
    }
  }
}

function requireStats(stats: RuntimeStatementStats | undefined): RuntimeStatementStats {
  if (stats !== undefined) return stats;
  throw runtimeError(
    'RUNTIME.EXECUTION_RESULT_MISSING',
    'Statistics execution completed without statement statistics',
    {},
  );
}

function middlewareResultMismatch(
  expected: 'query' | 'execute',
  received: 'query' | 'execute',
): Error {
  return runtimeError(
    'RUNTIME.MIDDLEWARE_RESULT_MISMATCH',
    `Middleware returned a ${received} result for a ${expected} operation`,
    { expected, received },
  );
}
