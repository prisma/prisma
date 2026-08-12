import type {
  AfterExecuteResult,
  AfterQueryResult,
  ExecuteInterceptResult,
  QueryInterceptResult,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from '@internal/framework-components/runtime';
import type { MongoExecutionPlan } from './mongo-execution-plan';
import type { MongoParamRefMutator } from './param-ref-mutator';

/**
 * Per-operation middleware context for Mongo. See {@link MongoMiddleware} for
 * plan/command lifecycle during `beforeQuery` / `beforeExecute` vs later hooks.
 */
export interface MongoMiddlewareContext extends RuntimeMiddlewareContext {
  /**
   * Stable digest of `meta.storageHash` plus the **resolved** wire command.
   * Valid only on post-resolution plans (typically `afterQuery`,
   * `afterExecute`, or intercept after `resolveParams`). Calling this from
   * `beforeQuery` or `beforeExecute` throws
   * `RUNTIME.CONTENT_HASH_REQUIRES_RESOLVED_COMMAND` because `plan.command`
   * is still an unresolved draft at that point.
   */
  contentHash(exec: MongoExecutionPlan): Promise<string>;
}

/**
 * Mongo-domain middleware. Extends the framework `RuntimeMiddleware`
 * parameterized over `MongoExecutionPlan` because the operation-specific
 * middleware runners invoke the lifecycle hooks with the post-lowering plan.
 *
 * `familyId` is optional so generic cross-family middleware (e.g.
 * telemetry) — which carry no `familyId` — remain assignable. When
 * present, it must be `'mongo'`; the runtime rejects mismatches at
 * construction time via `checkMiddlewareCompatibility`.
 *
 * **Pre-resolve `beforeQuery` contract:** `plan.command` holds the
 * unresolved `MongoLoweredDraft`, not a wire command. Observe and mutate
 * parameters via `params.entries()` / `replaceValue` / `replaceValues` only.
 * Do not inspect `plan.command` structurally or call `ctx.contentHash` in
 * this hook. After the chain, `resolveParams` produces the frozen wire
 * command used in `afterQuery` and for `contentHash`.
 */
export interface MongoMiddleware extends RuntimeMiddleware<MongoExecutionPlan> {
  readonly familyId?: 'mongo';
  /**
   * Runs after structural lower, before `resolveParams`. `plan.command` is the
   * unresolved draft; use `params` for param-ref access, not `plan.command`.
   */
  beforeQuery?(
    plan: MongoExecutionPlan,
    ctx: MongoMiddlewareContext,
    params?: MongoParamRefMutator,
  ): void | Promise<void>;
  interceptQuery?(
    plan: MongoExecutionPlan,
    ctx: MongoMiddlewareContext,
  ): Promise<QueryInterceptResult | undefined>;
  onRow?(
    row: Record<string, unknown>,
    plan: MongoExecutionPlan,
    ctx: MongoMiddlewareContext,
  ): Promise<void>;
  afterQuery?(
    plan: MongoExecutionPlan,
    result: AfterQueryResult,
    ctx: MongoMiddlewareContext,
  ): Promise<void>;
  /**
   * Runs after structural lower, before `resolveParams`. `plan.command` is the
   * unresolved draft; use `params` for param-ref access, not `plan.command`.
   */
  beforeExecute?(
    plan: MongoExecutionPlan,
    ctx: MongoMiddlewareContext,
    params?: MongoParamRefMutator,
  ): void | Promise<void>;
  interceptExecute?(
    plan: MongoExecutionPlan,
    ctx: MongoMiddlewareContext,
  ): Promise<ExecuteInterceptResult | undefined>;
  afterExecute?(
    plan: MongoExecutionPlan,
    result: AfterExecuteResult,
    ctx: MongoMiddlewareContext,
  ): Promise<void>;
}
