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
 * Per-query context threaded through every middleware phase
 * (`beforeExecute`, `onRow`, `afterExecute`). Allocated once per
 * `runtime.query()` call and shared by reference across all
 * middleware in the chain.
 *
 * - `signal` carries the per-query `AbortSignal` -- the same
 *   reference that `runtime.query(plan, { signal })` was invoked
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
   * - `'runtime'` — top-level `runtime.query(plan)`. The default scope
   *   used by the standard read/write paths.
   * - `'connection'` — `connection.query(plan)` after
   *   `runtime.connection()` checked out a connection from the pool.
   * - `'transaction'` — `transaction.query(plan)` inside an explicit
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
   * Identity for one `query()` call. The runtime mints a fresh value via
   * `crypto.randomUUID()` when it constructs the per-execute context, and
   * the same context reference is threaded through every middleware phase
   * (`beforeExecute`, `intercept`, `onRow`, `afterExecute`). Every hook in
   * one query call therefore observes the same `planExecutionId`; two
   * queries of the same plan observe distinct values. Use this to
   * correlate observations across the lifecycle of a single execute call
   * (tracing, timing, audit). See ADR 220.
   */
  readonly planExecutionId: string;
}

interface AfterResultBase {
  readonly latencyMs: number;
  readonly source: 'driver' | 'middleware';
}

export interface AfterQueryResult extends AfterResultBase {
  readonly rowCount: number;
  readonly completed: boolean;
}

export type AfterExecuteResult = AfterResultBase &
  (
    | {
        readonly stats: RuntimeStatementStats;
        readonly completed: true;
      }
    | {
        readonly completed: false;
      }
  );

export interface QueryInterceptResult {
  readonly rows: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>>;
}

export interface ExecuteInterceptResult {
  readonly stats: RuntimeStatementStats;
}

/**
 * Marker interface for family-specific param-ref mutators threaded into
 * `beforeExecute` as the third argument. The framework treats the mutator
 * opaquely — it allocates and forwards the family's mutator instance so
 * `operation-specific middleware runner` can stay family-agnostic. SQL extends this with
 * `SqlParamRefMutator` (over `ParamRef`); Mongo extends with
 * `MongoParamRefMutator` (over `MongoParamRef`).
 *
 * Extension authors target the family-specific mutator type, not this
 * marker.
 */
declare const PARAM_REF_MUTATOR_BRAND: unique symbol;
export type ParamRefMutator = { readonly [PARAM_REF_MUTATOR_BRAND]?: never };

/** Family-agnostic operation-specific middleware SPI. */
export interface RuntimeMiddleware<
  TPlan extends QueryPlan = QueryPlan,
  TMutator extends ParamRefMutator = ParamRefMutator,
> {
  readonly name: string;
  readonly familyId?: string;
  readonly targetId?: string;
  beforeQuery?(plan: TPlan, ctx: RuntimeMiddlewareContext, params?: TMutator): void | Promise<void>;
  interceptQuery?(
    plan: TPlan,
    ctx: RuntimeMiddlewareContext,
  ): Promise<QueryInterceptResult | undefined>;
  onRow?(row: Record<string, unknown>, plan: TPlan, ctx: RuntimeMiddlewareContext): Promise<void>;
  afterQuery?(plan: TPlan, result: AfterQueryResult, ctx: RuntimeMiddlewareContext): Promise<void>;
  beforeExecute?(
    plan: TPlan,
    ctx: RuntimeMiddlewareContext,
    params?: TMutator,
  ): void | Promise<void>;
  interceptExecute?(
    plan: TPlan,
    ctx: RuntimeMiddlewareContext,
  ): Promise<ExecuteInterceptResult | undefined>;
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
 * Optional per-operation options accepted by every family runtime.
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
 * Cross-family SPI for any runtime that can query or execute plans and be shut down.
 * Each family runtime (SQL, Mongo) satisfies this interface — SQL nominally,
 * Mongo structurally (due to its phantom Row parameter using a unique symbol).
 *
 * The `_row` intersection on `query` connects the `Row` type parameter to the
 * plan, mirroring how `QueryPlan<Row>` carries a phantom `_row?: Row`.
 */
export interface RuntimeStatementStats {
  readonly affectedRows: number;
}

export interface RuntimeExecutor<TPlan extends QueryPlan> {
  query<Row>(
    plan: TPlan & { readonly _row?: Row },
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row>;
  execute(plan: TPlan, options?: RuntimeExecuteOptions): Promise<RuntimeStatementStats>;
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
