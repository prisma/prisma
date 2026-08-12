import type { CodecCallContext } from '../shared/codec-types';
import { AsyncIterableResult } from './async-iterable-result';
import { runBeforeExecuteChain } from './before-execute-chain';
import type { ExecutionPlan, QueryPlan } from './query-plan';
import { checkAborted } from './race-against-abort';
import { runWithMiddleware } from './run-with-middleware';
import type {
  RuntimeExecuteOptions,
  RuntimeExecutor,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from './runtime-middleware';

/**
 * Constructor options shared by every concrete `RuntimeCore` subclass.
 *
 * Family runtimes typically build the middleware list and the
 * `RuntimeMiddlewareContext` themselves (running compatibility checks,
 * narrowing the context's `contract` field, etc.) before calling `super`.
 */
export interface RuntimeCoreOptions<TMiddleware extends RuntimeMiddleware<ExecutionPlan>> {
  readonly middleware: ReadonlyArray<TMiddleware>;
  readonly ctx: RuntimeMiddlewareContext;
}

/**
 * Family-agnostic abstract runtime base.
 *
 * Defines the entire `execute(plan)` template in one place:
 *
 * 1. `runBeforeCompile(plan)` — concrete; defaults to identity. SQL overrides
 *    this to run its `beforeCompile` middleware-hook chain.
 * 2. `lower(plan)` — abstract. Each family produces its `*ExecutionPlan`
 *    (SQL via `lowerSqlPlan`, Mongo via `adapter.lower`).
 * 3. `runBeforeExecuteChain(exec, this.middleware, this.ctx)` — concrete;
 *    runs every middleware's `beforeExecute` hook after lowering but
 *    before the row source is opened. Family runtimes that need a
 *    params mutator visible to a downstream encode step (SQL) override
 *    `execute` and call this helper themselves at the equivalent
 *    pre-encode point.
 * 4. `runWithMiddleware(exec, this.middleware, this.ctx,
 *    () => runDriver(exec))` — concrete; runs the intercept chain,
 *    drives the row source, fires `onRow` / `afterExecute`. Does
 *    **not** fire `beforeExecute` — see step 3.
 *
 * Concrete subclasses must implement `lower`, `runDriver`, and `close`.
 *
 * The class is generic over:
 * - `TPlan` — the family's pre-lowering plan type.
 * - `TExec` — the family's post-lowering (executable) plan type.
 * - `TMiddleware` — the family's middleware type. Constrained to
 *   `RuntimeMiddleware<TExec>` because `runWithMiddleware` invokes the
 *   `beforeExecute` / `onRow` / `afterExecute` hooks with the lowered
 *   `TExec`. (The spec/plan wording "RuntimeMiddleware<TPlan>" is
 *   tightened to `<TExec>` here so the helper call typechecks; the
 *   intent is unchanged — middleware sees the post-lowering plan.)
 */
export abstract class RuntimeCore<
  TPlan extends QueryPlan,
  TExec extends ExecutionPlan,
  TMiddleware extends RuntimeMiddleware<TExec>,
> implements RuntimeExecutor<TPlan>
{
  protected readonly middleware: ReadonlyArray<TMiddleware>;
  protected readonly ctx: RuntimeMiddlewareContext;

  constructor(options: RuntimeCoreOptions<TMiddleware>) {
    this.middleware = options.middleware;
    this.ctx = options.ctx;
  }

  /**
   * Pre-lowering hook for plan rewriting. Defaults to identity. Subclasses
   * may override to run a `beforeCompile` middleware chain (SQL does this
   * to support typed AST rewrites — see `before-compile-chain.ts`).
   */
  protected runBeforeCompile(plan: TPlan): TPlan | Promise<TPlan> {
    return plan;
  }

  /**
   * Lower a pre-lowering `TPlan` into the family's executable `TExec`.
   * Family-specific: SQL produces `{ sql, params, ast?, ... }`; Mongo
   * produces `{ command, ... }`.
   *
   * `ctx` carries per-query cancellation (and any future fields on
   * `CodecCallContext`); concrete subclasses forward it to the
   * encode-side codec dispatch site (e.g. SQL's `encodeParams` in m2,
   * Mongo's `resolveValue` in m3). The runtime allocates one ctx per
   * `execute()` call and threads the same reference everywhere; the
   * `signal` field inside may be `undefined`, but the ctx object itself
   * is always present.
   */
  protected abstract lower(plan: TPlan, ctx: CodecCallContext): TExec | Promise<TExec>;

  /**
   * Drive the underlying transport for a lowered `TExec`. Yields raw rows
   * directly from the driver as `Record<string, unknown>`; codec decoding
   * (if any) is the subclass's responsibility, applied by wrapping
   * `execute()` rather than living inside this hook.
   *
   * The `Row` type parameter on `execute()` is satisfied by the caller via
   * the plan's phantom `_row`; the runtime treats rows as opaque records
   * here and trusts the caller's row typing.
   */
  protected abstract runDriver(exec: TExec): AsyncIterable<Record<string, unknown>>;

  abstract close(): Promise<void>;

  execute<Row>(
    plan: TPlan & { readonly _row?: Row },
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row> {
    const self = this;
    const signal = options?.signal;
    // One ctx per execute() call. The ctx object is always allocated; the
    // `signal` field is only included when a signal was supplied (required
    // under exactOptionalPropertyTypes — `{ signal: undefined }` would not
    // satisfy `signal?: AbortSignal`).
    const codecCtx: CodecCallContext = signal === undefined ? {} : { signal };

    // Per-execute middleware context. Spread the stored runtime-level
    // template and mint a fresh `planExecutionId` so every hook in this
    // call observes the same value, and two executions of the same plan
    // observe distinct values. ADR 220. The same reference is threaded
    // through `runBeforeExecuteChain` and `runWithMiddleware`; the plan
    // itself flows through unchanged.
    const execCtx: RuntimeMiddlewareContext = {
      ...self.ctx,
      planExecutionId: crypto.randomUUID(),
    };

    async function* generator(): AsyncGenerator<Row, void, unknown> {
      // Pre-check the signal at entry so an already-aborted caller observes
      // RUNTIME.ABORTED on the first `next()` without any work being done.
      checkAborted(codecCtx, 'stream');

      const compiled = await self.runBeforeCompile(plan);
      const exec = await self.lower(compiled, codecCtx);
      // Fire the framework-level `beforeExecute` chain on the lowered
      // plan before opening the row source. Families that need
      // pre-encode mutator visibility (SQL) override `execute` to
      // inject the same chain at the equivalent point.
      await runBeforeExecuteChain<TExec>(exec, self.middleware, execCtx);
      // The driver yields raw `Record<string, unknown>`; we cast to `Row` here.
      // The Row contract is enforced by the caller via `plan._row`.
      yield* runWithMiddleware<TExec, Row>(
        exec,
        self.middleware,
        execCtx,
        () => self.runDriver(exec) as AsyncIterable<Row>,
      );
    }

    return new AsyncIterableResult(generator());
  }
}
