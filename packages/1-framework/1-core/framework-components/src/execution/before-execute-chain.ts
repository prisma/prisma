import type { ExecutionPlan } from './query-plan';
import { checkAborted, raceAgainstAbort } from './race-against-abort';
import type {
  ParamRefMutator,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from './runtime-middleware';

/**
 * Runs every middleware's `beforeExecute` hook in registration order,
 * threading through the (optional) family-specific `paramsMutator`.
 *
 * Why this lives outside {@link runWithMiddleware}: middleware that
 * mutates parameter values (e.g. cipherstash's bulk-encrypt SDK
 * round-trip) must run *before* the family runtime encodes those
 * parameters to driver wire format. Family runtimes call
 * `runBeforeExecuteChain` between the AST → plan lowering step and
 * the parameter encode step; the encode then observes the mutator's
 * `currentParams()` view. `runWithMiddleware` retains the rest of
 * the lifecycle (`intercept`, driver/row source loop, `onRow`,
 * `afterExecute`) but no longer fires `beforeExecute` itself.
 *
 * Lifecycle within this helper:
 *
 *  1. For each middleware in registration order, if `beforeExecute`
 *     is implemented:
 *     - `checkAborted(ctx, 'beforeExecute')` short-circuits if the
 *       caller already aborted at entry.
 *     - The hook is invoked with `(plan, ctx, paramsMutator)`. A
 *       middleware body that ignores the mutator stays compatible —
 *       JavaScript allows extra positional arguments.
 *     - If the hook returns a Promise, it is raced against
 *       `ctx.signal` via {@link raceAgainstAbort} so cooperative
 *       cancellation surfaces a `RUNTIME.ABORTED { phase:
 *       'beforeExecute' }` envelope even when the body itself
 *       ignores the signal.
 *
 * Error propagation: any error thrown by a `beforeExecute` body
 * (or surfaced by the abort race) propagates out of this helper
 * unchanged. The family runtime is responsible for converting it
 * into the appropriate `afterExecute(completed: false)` notification
 * once `runWithMiddleware` runs.
 *
 * Relationship to {@link runWithMiddleware}: the framework's
 * `RuntimeCore.execute` template calls this helper between
 * `lower(plan)` and `runWithMiddleware(...)`. Family runtimes that
 * override `execute` (e.g. SQL, which inlines lower + encode for
 * direct mutator threading) call this helper themselves at the
 * equivalent point — between the family's AST → draft-plan
 * lowering and the parameter-encode step.
 *
 * Intercept ordering: this helper fires unconditionally before
 * `runWithMiddleware`. `intercept` (inside `runWithMiddleware`)
 * therefore observes the post-`beforeExecute` plan — mutator
 * mutations are visible in the params interceptors see. The
 * trade-off is documented on `RuntimeMiddleware.intercept`.
 */
export async function runBeforeExecuteChain<
  TExec extends ExecutionPlan,
  TMutator extends ParamRefMutator = ParamRefMutator,
>(
  plan: TExec,
  middleware: ReadonlyArray<RuntimeMiddleware<TExec, TMutator>>,
  ctx: RuntimeMiddlewareContext,
  paramsMutator?: TMutator,
): Promise<void> {
  for (const mw of middleware) {
    if (!mw.beforeExecute) {
      continue;
    }
    checkAborted(ctx, 'beforeExecute');
    const work = mw.beforeExecute(plan, ctx, paramsMutator as TMutator);
    if (work !== undefined) {
      await raceAgainstAbort(Promise.resolve(work), ctx.signal, 'beforeExecute');
    }
  }
}
