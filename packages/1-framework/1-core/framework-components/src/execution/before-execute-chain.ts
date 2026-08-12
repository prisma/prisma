import type { ExecutionPlan } from './query-plan';
import { checkAborted, raceAgainstAbort } from './race-against-abort';
import type { RuntimeAbortedPhase } from './runtime-error';
import type {
  ParamRefMutator,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from './runtime-middleware';

/**
 * Runs every middleware's `beforeQuery` hook in registration order,
 * threading through the (optional) family-specific `paramsMutator`.
 *
 * Why this lives outside {@link runQueryWithMiddleware}: middleware that
 * mutates parameter values (e.g. cipherstash's bulk-encrypt SDK
 * round-trip) must run *before* the family runtime encodes those
 * parameters to driver wire format. Family runtimes call
 * `runBeforeQueryChain` between the AST → plan lowering step and
 * the parameter encode step; the encode then observes the mutator's
 * `currentParams()` view. `runQueryWithMiddleware` retains the rest of
 * the query lifecycle (`interceptQuery`, driver/row source loop, `onRow`,
 * `afterQuery`) but no longer fires `beforeQuery` itself.
 *
 * Lifecycle within this helper:
 *
 *  1. For each middleware in registration order, if `beforeQuery`
 *     is implemented:
 *     - `checkAborted(ctx, 'beforeQuery')` short-circuits if the
 *       caller already aborted at entry.
 *     - The hook is invoked with `(plan, ctx, paramsMutator)`. A
 *       middleware body that ignores the mutator stays compatible —
 *       JavaScript allows extra positional arguments.
 *     - If the hook returns a Promise, it is raced against
 *       `ctx.signal` via {@link raceAgainstAbort} so cooperative
 *       cancellation surfaces a `RUNTIME.ABORTED { phase:
 *       'beforeQuery' }` envelope even when the body itself
 *       ignores the signal.
 *
 * Error propagation: any error thrown by a `beforeQuery` body
 * (or surfaced by the abort race) propagates out of this helper
 * unchanged. The family runtime is responsible for converting it
 * into the appropriate `afterQuery(completed: false)` notification
 * once `runQueryWithMiddleware` runs.
 *
 * Relationship to {@link runQueryWithMiddleware}: the framework's
 * `RuntimeCore.query` template calls this helper between
 * `lower(plan)` and `runQueryWithMiddleware(...)`. Family runtimes that
 * override query preparation (e.g. SQL, which inlines lower + encode for
 * direct mutator threading) call this helper themselves at the
 * equivalent point — between the family's AST → draft-plan
 * lowering and the parameter-encode step.
 *
 * Intercept ordering: this helper fires unconditionally before
 * `runQueryWithMiddleware`. `interceptQuery` (inside
 * `runQueryWithMiddleware`) therefore observes the post-`beforeQuery`
 * plan — mutator mutations are visible in the params interceptors see.
 * The trade-off is documented on `RuntimeMiddleware.interceptQuery`.
 */
export function runBeforeQueryChain<
  TExec extends ExecutionPlan,
  TMutator extends ParamRefMutator = ParamRefMutator,
>(
  plan: TExec,
  middleware: ReadonlyArray<RuntimeMiddleware<TExec, TMutator>>,
  ctx: RuntimeMiddlewareContext,
  paramsMutator?: TMutator,
): Promise<void> {
  return runBeforeChain(
    plan,
    middleware,
    ctx,
    paramsMutator,
    'beforeQuery',
    (mw) => mw.beforeQuery,
  );
}

/**
 * Runs every middleware's `beforeExecute` hook in registration order,
 * threading through the (optional) family-specific `paramsMutator`.
 *
 * Why this lives outside {@link runExecuteWithMiddleware}: middleware that
 * mutates parameter values (e.g. cipherstash's bulk-encrypt SDK
 * round-trip) must run *before* the family runtime encodes those
 * parameters to driver wire format. Family runtimes call
 * `runBeforeExecuteChain` between the AST → plan lowering step and
 * the parameter encode step; the encode then observes the mutator's
 * `currentParams()` view. `runExecuteWithMiddleware` retains the rest of
 * the execute lifecycle (`interceptExecute`, driver statistics execution,
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
 * once `runExecuteWithMiddleware` runs.
 *
 * Relationship to {@link runExecuteWithMiddleware}: the framework's
 * `RuntimeCore.execute` template calls this helper between
 * `lower(plan)` and `runExecuteWithMiddleware(...)`. Family runtimes that
 * override execute (e.g. SQL, which inlines lower + encode for
 * direct mutator threading) call this helper themselves at the
 * equivalent point — between the family's AST → draft-plan
 * lowering and the parameter-encode step.
 *
 * Intercept ordering: this helper fires unconditionally before
 * `runExecuteWithMiddleware`. `interceptExecute` (inside
 * `runExecuteWithMiddleware`) therefore observes the post-`beforeExecute`
 * plan — mutator mutations are visible in the params interceptors see.
 * The trade-off is documented on `RuntimeMiddleware.interceptExecute`.
 */
export function runBeforeExecuteChain<
  TExec extends ExecutionPlan,
  TMutator extends ParamRefMutator = ParamRefMutator,
>(
  plan: TExec,
  middleware: ReadonlyArray<RuntimeMiddleware<TExec, TMutator>>,
  ctx: RuntimeMiddlewareContext,
  paramsMutator?: TMutator,
): Promise<void> {
  return runBeforeChain(
    plan,
    middleware,
    ctx,
    paramsMutator,
    'beforeExecute',
    (mw) => mw.beforeExecute,
  );
}

type BeforeHook<TExec extends ExecutionPlan, TMutator extends ParamRefMutator> = (
  plan: TExec,
  ctx: RuntimeMiddlewareContext,
  params?: TMutator,
) => void | Promise<void>;

async function runBeforeChain<TExec extends ExecutionPlan, TMutator extends ParamRefMutator>(
  plan: TExec,
  middleware: ReadonlyArray<RuntimeMiddleware<TExec, TMutator>>,
  ctx: RuntimeMiddlewareContext,
  paramsMutator: TMutator | undefined,
  phase: RuntimeAbortedPhase,
  selectHook: (
    middleware: RuntimeMiddleware<TExec, TMutator>,
  ) => BeforeHook<TExec, TMutator> | undefined,
): Promise<void> {
  for (const mw of middleware) {
    const hook = selectHook(mw);
    if (hook === undefined) continue;
    checkAborted(ctx, phase);
    const work = hook(plan, ctx, paramsMutator);
    if (work !== undefined) {
      await raceAgainstAbort(Promise.resolve(work), ctx.signal, phase);
    }
  }
}
