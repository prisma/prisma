import { AsyncIterableResult } from './async-iterable-result';
import type { ExecutionPlan } from './query-plan';
import type { RuntimeMiddleware, RuntimeMiddlewareContext } from './runtime-middleware';

/**
 * Drives a single execution of `runDriver()` through the middleware
 * lifecycle's intercept + row-source + termination phases.
 *
 * Lifecycle, in order:
 *  1. For each middleware in registration order: `intercept(exec, ctx)`. The
 *     first non-`undefined` result wins; subsequent middleware's `intercept`
 *     does not fire. On a hit, the runtime emits a `middleware.intercept`
 *     debug event naming the winning middleware, switches the row source to
 *     the intercepted rows, and proceeds with `source: 'middleware'`. On
 *     all-passthrough (every `intercept` returns `undefined` or is omitted),
 *     `source: 'driver'` is used and the row source is `runDriver()`.
 *  2. Iterate the row source. On the driver path, for each row, for each
 *     middleware in registration order: `onRow(row, exec, ctx)`; then yield
 *     the row. On the intercepted hit path, `onRow` is skipped — intercepted
 *     rows did not originate from a driver row stream — but rows are still
 *     yielded to the consumer in order.
 *  3. On successful completion: for each middleware in registration order:
 *     `afterExecute(exec, { rowCount, latencyMs, completed: true, source },
 *     ctx)`.
 *  4. On any error thrown during steps 1–2: for each middleware in
 *     registration order: `afterExecute(exec, { rowCount, latencyMs,
 *     completed: false, source }, ctx)`. Errors thrown by `afterExecute`
 *     during the error path are swallowed so they do not mask the original
 *     error. The original error is then rethrown.
 *
 * `beforeExecute` is **not** fired here — see
 * {@link runBeforeExecuteChain} in `before-execute-chain.ts`. Family
 * runtimes call that helper between the AST → plan lowering step and
 * the parameter encode step so middleware that mutates ParamRef
 * values (e.g. cipherstash bulk-encrypt) can have its mutations
 * visible to encode. `runWithMiddleware` operates on the fully-
 * encoded plan; interceptors therefore observe a fully-mutated,
 * encoded plan.
 *
 * The `source` field on `AfterExecuteResult` lets observers (telemetry,
 * lints, budgets) distinguish driver-served from middleware-served
 * executions without needing their own out-of-band signal.
 *
 * This helper is the single canonical implementation of the
 * intercept-and-row-source loop; family runtimes should not
 * reimplement it.
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
    // Deferred so a winning interceptor can skip `runDriver()` entirely.
    // For factories that lazily produce async generators this is a no-op,
    // but factories that do eager work (e.g. acquiring a connection,
    // sending a query) must not run on the intercepted hit path.
    let rowSource: AsyncIterable<Row> | Iterable<Row> | undefined;

    try {
      for (const mw of middleware) {
        if (!mw.intercept) {
          continue;
        }
        // Mark the lifecycle as middleware-driven *before* awaiting the
        // hook. If `intercept` throws, the catch block reports the failure
        // as `source: 'middleware'` — the failure originated in the
        // intercept chain, not in the driver. If `intercept` returns
        // `undefined` (passthrough), we revert to `'driver'` and continue.
        source = 'middleware';
        const result = await mw.intercept(exec, ctx);
        if (result === undefined) {
          source = 'driver';
          continue;
        }
        ctx.log.debug?.({ event: 'middleware.intercept', middleware: mw.name });
        // The intercepted rows are typed as `Record<string, unknown>` at
        // the SPI level; the consumer's `Row` type parameter is enforced by
        // the caller (via the plan's phantom `_row`) the same way driver
        // rows are. Cast through unknown to bridge the SPI shape to the
        // caller-supplied Row.
        rowSource = result.rows as unknown as AsyncIterable<Row> | Iterable<Row>;
        break;
      }

      if (source === 'driver') {
        rowSource = runDriver();
      }

      // `rowSource` is always assigned by this point: either the intercepted
      // rows (on a hit) or `runDriver()` (on the driver path).
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
      const latencyMs = Date.now() - startedAt;
      for (const mw of middleware) {
        if (mw.afterExecute) {
          try {
            await mw.afterExecute(exec, { rowCount, latencyMs, completed, source }, ctx);
          } catch {
            // Swallow afterExecute errors during the error path so they do not
            // mask the original error.
          }
        }
      }

      throw error;
    }

    const latencyMs = Date.now() - startedAt;
    for (const mw of middleware) {
      if (mw.afterExecute) {
        await mw.afterExecute(exec, { rowCount, latencyMs, completed, source }, ctx);
      }
    }
  };

  return new AsyncIterableResult(iterator());
}
