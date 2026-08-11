import { blindCast } from '@internal/utils/casts';
import { AsyncIterableResult } from './async-iterable-result';
import type { ExecutionPlan } from './query-plan';
import type {
  AfterQueryResult,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
  RuntimeStatementStats,
} from './runtime-middleware';

export function runQueryWithMiddleware<TExec extends ExecutionPlan, Row>(
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
        if (!mw.interceptQuery) continue;
        source = 'middleware';
        const result = await mw.interceptQuery(exec, ctx);
        if (result === undefined) {
          source = 'driver';
          continue;
        }
        ctx.log.debug?.({ event: 'middleware.interceptQuery', middleware: mw.name });
        rowSource = blindCast<
          AsyncIterable<Row> | Iterable<Row>,
          'intercepted rows are supplied as the runtime operation row type'
        >(result.rows);
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

export async function runExecuteWithMiddleware<TExec extends ExecutionPlan>(
  exec: TExec,
  middleware: ReadonlyArray<RuntimeMiddleware<TExec>>,
  ctx: RuntimeMiddlewareContext,
  runDriver: () => Promise<RuntimeStatementStats>,
): Promise<RuntimeStatementStats> {
  const startedAt = Date.now();
  let source: 'driver' | 'middleware' = 'driver';
  let stats: RuntimeStatementStats | undefined;

  try {
    for (const mw of middleware) {
      if (!mw.interceptExecute) continue;
      source = 'middleware';
      const result = await mw.interceptExecute(exec, ctx);
      if (result === undefined) {
        source = 'driver';
        continue;
      }
      ctx.log.debug?.({ event: 'middleware.interceptExecute', middleware: mw.name });
      stats = result.stats;
      break;
    }

    if (stats === undefined) {
      stats = await runDriver();
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    for (const mw of middleware) {
      if (!mw.afterExecute) continue;
      try {
        await mw.afterExecute(exec, { latencyMs, completed: false, source }, ctx);
      } catch {
        // Preserve the operation error when completion observers also fail.
      }
    }
    throw error;
  }

  const latencyMs = Date.now() - startedAt;
  for (const mw of middleware) {
    if (mw.afterExecute) {
      await mw.afterExecute(exec, { stats, latencyMs, completed: true, source }, ctx);
    }
  }
  return stats;
}

async function notifyQueryCompletion<TExec extends ExecutionPlan>(
  middleware: ReadonlyArray<RuntimeMiddleware<TExec>>,
  exec: TExec,
  ctx: RuntimeMiddlewareContext,
  result: AfterQueryResult,
  swallowErrors: boolean,
): Promise<void> {
  for (const mw of middleware) {
    if (!mw.afterQuery) continue;
    if (swallowErrors) {
      try {
        await mw.afterQuery(exec, result, ctx);
      } catch {
        // Preserve the operation error when completion observers also fail.
      }
    } else {
      await mw.afterQuery(exec, result, ctx);
    }
  }
}
