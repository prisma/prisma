import type { AsyncIterableResult } from './async-iterable-result';
import type { ExecutionPlan, QueryPlan } from './query-plan';
import { runtimeError } from './runtime-error';

export interface RuntimeLog {
  info(event: unknown): void;
  warn(event: unknown): void;
  error(event: unknown): void;
  debug?(event: unknown): void;
}

/**
 * Per-execute context threaded through every middleware phase
 * (`beforeExecute`, `onRow`, `afterExecute`). Allocated once per
 * `runtime.execute()` call and shared by reference across all
 * middleware in the chain.
 *
 * - `signal` carries the per-query `AbortSignal` -- the same
 *   reference that `runtime.execute(plan, { signal })` was invoked
 *   with, and the same reference threaded into the per-call
 *   `CodecCallContext` (ADR 207). Middleware that wraps a
 *   network-backed SDK forwards `ctx.signal` into that SDK to
 *   propagate caller cancellation; pure-CPU middleware ignores it.
 *
 * Symmetric plumbing across all middleware phases (rather than only
 * `beforeExecute`) is a deliberate choice: a middleware that wraps a
 * downstream observability hook or post-processor in `afterExecute` /
 * `onRow` needs the same cancellation reach as its `beforeExecute`
 * counterpart.
 */
export interface RuntimeMiddlewareContext {
  readonly contract: unknown;
  readonly mode: 'strict' | 'permissive';
  readonly now: () => number;
  readonly log: RuntimeLog;
  /**
   * Returns a stable string identifying the (storage, statement, params)
   * tuple of an execution. Two semantically equivalent executions return
   * the same string. Used by middleware that need per-execution identity
   * (caching, request coalescing).
   *
   * The family runtime owns the implementation:
   * - SQL: `meta.storageHash` + `exec.sql` + `canonicalStringify(exec.params)`
   * - Mongo: `meta.storageHash` + `canonicalStringify({ ...exec.command })`
   *
   * The method is `async` because the underlying digest helper
   * (`hashContent`) uses the WebCrypto API, whose `crypto.subtle.digest`
   * primitive is asynchronous by design.
   *
   * The returned string is intended to be consumed directly as a `Map` key
   * — it is not (and should not be) further hashed by callers.
   */
  contentHash(exec: ExecutionPlan): Promise<string>;
  /**
   * Per-execute cancellation signal threaded through every middleware
   * phase. Middleware that wraps async work or downstream cancellable
   * primitives should observe this and abort early when the consumer
   * cancels.
   */
  readonly signal?: AbortSignal;
  /**
   * Identifies the queryable scope this execution is running under.
   *
   * - `'runtime'` — top-level `runtime.execute(plan)`. The default scope
   *   used by the standard read/write paths.
   * - `'connection'` — `connection.execute(plan)` after
   *   `runtime.connection()` checked out a connection from the pool.
   * - `'transaction'` — `transaction.execute(plan)` inside an explicit
   *   transaction, or a query routed through `withTransaction`.
   *
   * Middleware that should only act at the top level read this field to
   * bypass non-runtime scopes. The cache middleware uses it to skip
   * caching inside transactions (where read-after-write coherence is the
   * caller's expectation) and dedicated connections (where the user has
   * explicitly stepped outside the shared cache surface). Observers that
   * don't care about the scope can ignore the field.
   *
   * Family runtimes populate this at context-construction time per
   * scope. Existing middleware that ignore the field are unaffected.
   */
  readonly scope: 'runtime' | 'connection' | 'transaction';
  /**
   * Identity for one `execute()` call. The runtime mints a fresh value via
   * `crypto.randomUUID()` when it constructs the per-execute context, and
   * the same context reference is threaded through every middleware phase
   * (`beforeExecute`, `intercept`, `onRow`, `afterExecute`). Every hook in
   * one execute call therefore observes the same `planExecutionId`; two
   * executions of the same plan observe distinct values. Use this to
   * correlate observations across the lifecycle of a single execute call
   * (tracing, timing, audit). See ADR 220.
   */
  readonly planExecutionId: string;
}

export interface AfterExecuteResult {
  readonly rowCount: number;
  readonly latencyMs: number;
  readonly completed: boolean;
  /**
   * Indicates where the rows observed during this execution came from.
   *
   * - `'driver'` — the default. Rows came from the underlying driver via
   *   `runDriver` / `runWithMiddleware`'s normal path.
   * - `'middleware'` — a `RuntimeMiddleware.intercept` hook short-circuited
   *   execution and supplied the rows directly. The driver was not invoked.
   *
   * Observers (telemetry, lints, budgets) that need to distinguish between
   * driver-served and middleware-served executions read this field.
   * Observers that don't care can ignore it.
   */
  readonly source: 'driver' | 'middleware';
}

/**
 * Result of a successful `RuntimeMiddleware.intercept` hook.
 *
 * Carries the rows that the middleware wishes to return in place of
 * invoking the driver. The runtime iterates `rows` in order and yields
 * each row to the consumer; `beforeExecute`, `runDriver`, and `onRow` are
 * all skipped on the hit path. `afterExecute` still fires with
 * `source: 'middleware'`.
 *
 * `rows` accepts both `Iterable` (arrays, sync generators) and
 * `AsyncIterable` (async generators). `for await` natively handles both
 * via `Symbol.asyncIterator` / `Symbol.iterator` fallback, so the
 * orchestrator does not need to branch on the variant. Cached arrays in
 * the cache middleware are the common case; streaming variants support
 * future use cases like mock layers replaying recordings.
 *
 * Row shape is `Record<string, unknown>` — the same untyped shape
 * `onRow` receives. The SQL runtime decodes intercepted rows through its
 * normal codec pass, so interceptors cache and return raw (undecoded)
 * rows.
 */
export interface InterceptResult {
  readonly rows: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>>;
}

/**
 * Marker interface for family-specific param-ref mutators threaded into
 * `beforeExecute` as the third argument. The framework treats the mutator
 * opaquely — it allocates and forwards the family's mutator instance so
 * `runWithMiddleware` can stay family-agnostic. SQL extends this with
 * `SqlParamRefMutator` (over `ParamRef`); Mongo extends with
 * `MongoParamRefMutator` (over `MongoParamRef`).
 *
 * Extension authors target the family-specific mutator type, not this
 * marker.
 */
declare const PARAM_REF_MUTATOR_BRAND: unique symbol;
export type ParamRefMutator = { readonly [PARAM_REF_MUTATOR_BRAND]?: never };

/**
 * Family-agnostic middleware SPI parameterized over the plan marker.
 *
 * `TPlan` defaults to the framework `QueryPlan` marker so a generic
 * middleware (e.g. cross-family telemetry) can be authored without
 * naming a family. Family-specific middleware (`SqlMiddleware`,
 * `MongoMiddleware`) narrow `TPlan` to their concrete plan type.
 *
 * `TMutator` is the family-specific {@link ParamRefMutator} the runtime
 * threads into `beforeExecute(plan, ctx, params)` as a third argument.
 * Existing `(plan)` / `(plan, ctx)` middleware bodies continue to compile
 * — TypeScript permits assigning a function with fewer parameters to a
 * function-typed slot that declares more. The third arg is additive.
 */
export interface RuntimeMiddleware<
  TPlan extends QueryPlan = QueryPlan,
  TMutator extends ParamRefMutator = ParamRefMutator,
> {
  readonly name: string;
  readonly familyId?: string;
  readonly targetId?: string;
  /**
   * Optional short-circuit hook. Runs inside `runWithMiddleware`, after
   * the orchestrator receives the lowered plan and before any
   * `beforeExecute` hook fires. Middleware run in registration order; the
   * first to return a non-`undefined` `InterceptResult` wins, and
   * subsequent middleware's `intercept` does not fire.
   *
   * On a hit, `beforeExecute`, `runDriver`, and `onRow` are all skipped.
   * `afterExecute` still fires with `source: 'middleware'`.
   *
   * Returning `undefined` (or omitting the hook entirely) signals
   * passthrough — execution proceeds through the normal driver path.
   *
   * Errors thrown inside `intercept` are rethrown by `runWithMiddleware`
   * as the original `Error` — no envelope is guaranteed at this layer.
   * Before rethrowing, `afterExecute` fires with `completed: false` and
   * `source: 'middleware'`. Errors thrown by `afterExecute` during the
   * error path remain swallowed (existing semantics, unchanged).
   *
   * Used by middleware that need to short-circuit execution and supply
   * rows directly: caching, mocks, rate limiting, circuit breaking.
   */
  intercept?(plan: TPlan, ctx: RuntimeMiddlewareContext): Promise<InterceptResult | undefined>;
  /**
   * Fires after the family runtime has produced a draft execution
   * plan from the AST, but before the family encodes parameter values
   * to driver wire format. Mutations applied via the
   * family-specific `params` mutator are visible to the subsequent
   * encode step.
   *
   * Lifecycle position (SQL example):
   *   `runBeforeCompile → lowerSqlPlan → beforeExecute → encodeParams → intercept → driver`.
   *
   * The `params` argument is a family-specific {@link ParamRefMutator}
   * scoped to the value slots of `ParamRef` nodes in the plan's AST.
   * Middleware that doesn't need to mutate params can ignore the
   * argument; existing `(plan)` / `(plan, ctx)` bodies stay compatible.
   *
   * `ctx.signal` carries the per-query `AbortSignal`; middleware that
   * wraps a network SDK forwards it. Cooperative cancellation
   * surfaces a `RUNTIME.ABORTED { phase: 'beforeExecute' }` envelope
   * promptly even when the body ignores the signal.
   *
   * Intercept ordering: `intercept` runs *after* this hook; an
   * interceptor that short-circuits the driver path still observes
   * the post-`beforeExecute`, fully-encoded plan. The trade-off is
   * that any `beforeExecute` SDK round-trips happen even when a
   * downstream interceptor would have skipped the driver entirely.
   */
  beforeExecute?(
    plan: TPlan,
    ctx: RuntimeMiddlewareContext,
    params?: TMutator,
  ): void | Promise<void>;
  onRow?(row: Record<string, unknown>, plan: TPlan, ctx: RuntimeMiddlewareContext): Promise<void>;
  afterExecute?(
    plan: TPlan,
    result: AfterExecuteResult,
    ctx: RuntimeMiddlewareContext,
  ): Promise<void>;
}

/**
 * Cross-family middleware — one that doesn't constrain `familyId` or
 * `targetId` and is therefore compatible with any family runtime's
 * middleware array (`SqlMiddleware[]`, `MongoMiddleware[]`, etc.).
 *
 * The intersection `RuntimeMiddleware & { familyId?: undefined; targetId?: undefined }`
 * pins both optional properties to exactly `undefined` (intersecting
 * `string | undefined` with `undefined` collapses to `undefined`). Under
 * `exactOptionalPropertyTypes: true`, the plain `RuntimeMiddleware` shape
 * — with `familyId?: string` — is *not* assignable to `SqlMiddleware`
 * (which narrows `familyId?: 'sql'`) because `string` is wider than
 * `'sql'`. Pinning the property to `undefined` makes the value a subtype
 * of every narrowed variant: `undefined` extends both `'sql' | undefined`
 * and `'mongo' | undefined`, so a `CrossFamilyMiddleware` value drops
 * into a SQL or Mongo middleware slot without a cast.
 *
 * Cross-family middleware factories (`createCacheMiddleware`, future
 * `audit` / OTel middleware) declare this as their return type so the
 * cross-family typing is named once rather than re-spelled at every call
 * site.
 */
export type CrossFamilyMiddleware<TPlan extends QueryPlan = QueryPlan> =
  RuntimeMiddleware<TPlan> & {
    readonly familyId?: undefined;
    readonly targetId?: undefined;
  };

/**
 * Optional per-`execute` options accepted by every family runtime.
 *
 * `signal` is the per-query cancellation signal. The runtime threads the
 * signal through to every codec call for the query and uses it to short-
 * circuit the row stream with `RUNTIME.ABORTED` when the caller aborts.
 * Omitting the option (or passing `undefined`) preserves today's behavior
 * bit-for-bit.
 */
export interface RuntimeExecuteOptions {
  readonly signal?: AbortSignal;
  readonly scope?: 'runtime' | 'connection' | 'transaction';
}

/**
 * Cross-family SPI for any runtime that can execute plans and be shut down.
 * Each family runtime (SQL, Mongo) satisfies this interface — SQL nominally,
 * Mongo structurally (due to its phantom Row parameter using a unique symbol).
 *
 * The `_row` intersection on `execute` connects the `Row` type parameter to the
 * plan, mirroring how `QueryPlan<Row>` carries a phantom `_row?: Row`.
 */
export interface RuntimeExecutor<TPlan extends QueryPlan> {
  execute<Row>(
    plan: TPlan & { readonly _row?: Row },
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row>;
  close(): Promise<void>;
}

export function checkMiddlewareCompatibility(
  middleware: RuntimeMiddleware,
  runtimeFamilyId: string,
  runtimeTargetId: string,
): void {
  if (middleware.targetId !== undefined && middleware.familyId === undefined) {
    throw runtimeError(
      'RUNTIME.MIDDLEWARE_INCOMPATIBLE',
      `Middleware '${middleware.name}' specifies targetId '${middleware.targetId}' without familyId`,
      { middleware: middleware.name, targetId: middleware.targetId },
    );
  }

  if (middleware.familyId !== undefined && middleware.familyId !== runtimeFamilyId) {
    throw runtimeError(
      'RUNTIME.MIDDLEWARE_FAMILY_MISMATCH',
      `Middleware '${middleware.name}' requires family '${middleware.familyId}' but the runtime is configured for family '${runtimeFamilyId}'`,
      { middleware: middleware.name, middlewareFamilyId: middleware.familyId, runtimeFamilyId },
    );
  }

  if (middleware.targetId !== undefined && middleware.targetId !== runtimeTargetId) {
    throw runtimeError(
      'RUNTIME.MIDDLEWARE_TARGET_MISMATCH',
      `Middleware '${middleware.name}' requires target '${middleware.targetId}' but the runtime is configured for target '${runtimeTargetId}'`,
      { middleware: middleware.name, middlewareTargetId: middleware.targetId, runtimeTargetId },
    );
  }
}
