import type { Contract, PlanMeta } from '@internal/contract/types';
import type {
  AfterExecuteResult,
  RuntimeMiddleware,
  RuntimeMiddlewareContext,
} from '@internal/framework-components/runtime';
import type { SqlStorage } from '@internal/sql-contract/types';
import type { AnyQueryAst } from '@internal/sql-relational-core/ast';
import type { SqlParamRefMutator } from '@internal/sql-relational-core/middleware';
import type { SqlExecutionPlan } from '@internal/sql-relational-core/plan';

export interface SqlMiddlewareContext extends RuntimeMiddlewareContext {
  readonly contract: Contract<SqlStorage>;
}

/**
 * Pre-lowering query view passed to `beforeCompile`. Carries the typed SQL
 * AST and plan metadata; `sql`/`params` are produced later by the adapter.
 */
export interface DraftPlan {
  readonly ast: AnyQueryAst;
  readonly meta: PlanMeta;
}

export interface SqlMiddleware<TCodecMap extends Record<string, unknown> = Record<string, unknown>>
  extends RuntimeMiddleware<SqlExecutionPlan, SqlParamRefMutator<TCodecMap>> {
  readonly familyId?: 'sql';
  /**
   * Rewrite the query AST before it is lowered to SQL. Middlewares run in
   * registration order; each sees the predecessor's output, so rewrites
   * compose (e.g. soft-delete + tenant isolation).
   *
   * Return `undefined` (or a draft whose `ast` reference equals the input's)
   * to pass through. Return a draft with a new `ast` reference to replace it;
   * the runtime emits a `middleware.rewrite` debug log event and continues
   * with the new draft. `adapter.lower()` runs once after the chain.
   *
   * Use `AstRewriter` / `SelectAst.withWhere` / `AndExpr.of` etc. to build
   * the rewritten AST. Predicates and literals go through parameterized
   * constructors by default — no SQL-injection surface is added. **Warning:**
   * constructing `LiteralExpr.of(userInput)` from untrusted input bypasses
   * that guarantee; use `ParamRef.of(userInput, ...)` instead.
   *
   * See `docs/architecture docs/subsystems/4. Runtime & Middleware Framework.md`.
   */
  beforeCompile?(draft: DraftPlan, ctx: SqlMiddlewareContext): Promise<DraftPlan | undefined>;
  /**
   * Mutate `ParamRef.value` slots before encode runs. The third
   * `params` argument is a {@link SqlParamRefMutator} scoped to value
   * slots only — SQL strings, projections, and `ParamRef` membership
   * are not mutable. Existing `(plan)` and `(plan, ctx)` middleware
   * bodies that ignore the additional argument continue to compile
   * and run unchanged.
   *
   * Lifecycle position:
   *   `beforeCompile → lowerSqlPlan → beforeExecute → encodeParams → intercept → driver`.
   *
   * The plan handed in is the SQL execution plan after lowering but
   * *before* parameter encoding: `plan.params[i]` is the user-domain
   * value the mutator's `entries()` iterator surfaces (e.g. an
   * `EncryptedEnvelopeBase` for a cipherstash-codec'd column, or a
   * plain JS value for non-codec'd ParamRefs). Mutations applied via
   * `params.replaceValue` / `replaceValues` are visible to encode,
   * which then renders the mutated value through the column's codec.
   *
   * `ctx.signal` carries the per-query `AbortSignal` (ADR 207);
   * middleware that wraps a network SDK forwards `ctx.signal` to
   * that SDK. Cooperative cancellation: a body that ignores the
   * signal still surfaces `RUNTIME.ABORTED { phase: 'beforeExecute' }`
   * promptly via the runtime's race against the signal.
   */
  beforeExecute?(
    plan: SqlExecutionPlan,
    ctx: SqlMiddlewareContext,
    params?: SqlParamRefMutator<TCodecMap>,
  ): void | Promise<void>;
  onRow?(
    row: Record<string, unknown>,
    plan: SqlExecutionPlan,
    ctx: SqlMiddlewareContext,
  ): Promise<void>;
  afterExecute?(
    plan: SqlExecutionPlan,
    result: AfterExecuteResult,
    ctx: SqlMiddlewareContext,
  ): Promise<void>;
}
