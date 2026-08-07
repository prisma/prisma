import type { ExecutionPlan } from './query-plan';
import { checkAborted, raceAgainstAbort } from './race-against-abort';
import type { RuntimeAbortedPhase } from './runtime-error';
import type {
  ParamRefMutator,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from './runtime-middleware';

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
