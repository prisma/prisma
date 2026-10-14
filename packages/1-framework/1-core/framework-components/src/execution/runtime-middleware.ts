import type { AnnotationValue, OperationKind } from '../annotations';
import type { AsyncIterableResult } from './async-iterable-result';
import type { ExecutionPlan, QueryPlan } from './query-plan';
import { runtimeError } from './runtime-error';

export interface RuntimeLog {
  info(event: unknown): void;
  warn(event: unknown): void;
  error(event: unknown): void;
  debug?(event: unknown): void;
}

/** What every activity has: an identity, a kind and the annotations the user put on it. */
export interface ActivityBase {
  /** A fresh `crypto.randomUUID()` per activity. */
  readonly id: string;
  readonly kind: string;
  /** Empty when the activity carries no annotation. */
  readonly annotations: ReadonlyMap<string, AnnotationValue<unknown, OperationKind>>;
}

/** One statement sent to the database: `query()` sends it for its rows, `execute()` for its statistics. */
export interface StatementActivity<TPlan extends QueryPlan = QueryPlan> extends ActivityBase {
  readonly kind: 'statement';
  readonly returns: 'rows' | 'stats';
  /** The plan the caller sent. */
  readonly plan: TPlan;
}

/** Started by `transaction()`, ended by `commit()` or `rollback()`. */
export interface TransactionActivity extends ActivityBase {
  readonly kind: 'transaction';
}

export type RuntimeActivity = StatementActivity | TransactionActivity;

/**
 * The context of one activity. Every hook of the activity receives the same object.
 */
export interface ActivityContext {
  readonly contract: unknown;
  readonly mode: 'strict' | 'permissive';
  readonly now: () => number;
  readonly log: RuntimeLog;
  /**
   * A stable digest of an execution's storage hash, statement and parameters, usable directly as a `Map` key. Two equivalent executions return the same string.
   */
  contentHash(exec: ExecutionPlan): Promise<string>;
  /** The caller's cancellation signal, when it passed one. */
  readonly signal?: AbortSignal;
  /** The scope of the queryable the activity was started on. */
  readonly scope: 'runtime' | 'connection' | 'transaction';
  /** The parent activity's context, or `undefined` at the root. */
  readonly parent: ActivityContext | undefined;
  /** The state object stored under `key` for this activity, created empty on first use and dropped when the activity is finalized. Middleware that use the same key share the object. */
  state(key: string | symbol): Record<string | symbol, unknown>;
  /** Whether any ancestor of this activity is a transaction. */
  inTransaction(): boolean;
}

/** The fields a runtime supplies to build an activity's context; the runtime adds `parent`, `state` and `inTransaction`. */
export type ActivityContextFields<TContext extends ActivityContext = ActivityContext> = Omit<
  TContext,
  'parent' | 'state' | 'inTransaction'
>;

export interface TransactionEnded {
  readonly kind: 'transaction';
  readonly outcome: 'succeeded' | 'failed';
}

export type StatementEnded = {
  readonly kind: 'statement';
  /** `stopped` when the caller stopped reading the rows. */
  readonly outcome: 'succeeded' | 'failed' | 'stopped';
  readonly latencyMs: number;
  /** `middleware` when an `intercept` handler supplied the result, or threw. */
  readonly source: 'driver' | 'middleware';
} & (
  | { readonly returns: 'rows'; readonly rowCount: number }
  | { readonly returns: 'stats'; readonly stats?: RuntimeStatementStats }
);

export type ActivityEndedResult = TransactionEnded | StatementEnded;

export interface ActivityFinalizedResult {
  /** `unknown` when the runtime cannot tell whether the writes landed; treat it like `committed` when a committed write must not be missed. */
  readonly outcome: 'committed' | 'rolled-back' | 'unknown';
}

export interface QueryInterceptResult {
  readonly rows: AsyncIterable<Record<string, unknown>> | Iterable<Record<string, unknown>>;
}

export interface ExecuteInterceptResult {
  readonly stats: RuntimeStatementStats;
}

/**
 * Marker for the family-specific parameter mutator passed to `beforeEncode`. SQL extends it as `SqlParamRefMutator`, Mongo as `MongoParamRefMutator`.
 */
declare const PARAM_REF_MUTATOR_BRAND: unique symbol;
export type ParamRefMutator = { readonly [PARAM_REF_MUTATOR_BRAND]?: never };

/** The lifecycle events every activity has. They observe; they cannot change the activity. */
export interface ActivityObserver {
  readonly name: string;
  /** The act begins. */
  activityStarted?(activity: RuntimeActivity, ctx: ActivityContext): Promise<void>;
  /** The act ends, with its outcome as the actor saw it. An error thrown when the activity succeeded fails it and reaches the caller; after a failure it is swallowed. */
  activityEnded?(
    activity: RuntimeActivity,
    result: ActivityEndedResult,
    ctx: ActivityContext,
  ): Promise<void>;
  /** The act's effects are final. A thrown error is passed to `ctx.log.error` and swallowed; later middleware still run. */
  activityFinalized?(
    activity: RuntimeActivity,
    result: ActivityFinalizedResult,
    ctx: ActivityContext,
  ): Promise<void>;
}

/**
 * Family-agnostic middleware. `TPlan` is the encoded execution plan the statement interceptors receive; `TMutator` is the family's parameter mutator.
 */
export interface RuntimeMiddleware<
  TPlan extends QueryPlan = QueryPlan,
  TMutator extends ParamRefMutator = ParamRefMutator,
> extends ActivityObserver {
  readonly familyId?: string;
  readonly targetId?: string;
  /** Runs after lowering, before codecs encode the parameter values. Throw to block the statement; change values through `params`. */
  beforeEncode?(draft: TPlan, ctx: ActivityContext, params?: TMutator): void | Promise<void>;
  /** Supplies a statement's result instead of running it. Middleware run in registration order and the first handler that returns a result wins. */
  intercept?: {
    onQuery?(plan: TPlan, ctx: ActivityContext): Promise<QueryInterceptResult | undefined>;
    onExecute?(plan: TPlan, ctx: ActivityContext): Promise<ExecuteInterceptResult | undefined>;
  };
  /** Runs for each row the driver returns; not for intercepted rows. Throw to stop the stream. */
  onRow?(row: Record<string, unknown>, plan: TPlan, ctx: ActivityContext): Promise<void>;
}

/**
 * Middleware that names no family or target, so it fits any family runtime's middleware array.
 */
export type CrossFamilyMiddleware<TPlan extends QueryPlan = QueryPlan> =
  RuntimeMiddleware<TPlan> & {
    readonly familyId?: undefined;
    readonly targetId?: undefined;
  };

/** Per-operation options accepted by every family runtime. */
export interface RuntimeExecuteOptions {
  readonly signal?: AbortSignal;
  readonly scope?: 'runtime' | 'connection' | 'transaction';
}

export interface RuntimeStatementStats {
  readonly affectedRows: number;
}

/** Any runtime that can query or execute plans and be shut down. */
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
