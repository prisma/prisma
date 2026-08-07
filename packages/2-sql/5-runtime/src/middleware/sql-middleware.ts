import type { Contract, PlanMeta } from '@internal/contract/types';
import type {
  AfterExecuteResult,
  AfterQueryResult,
  ExecuteInterceptResult,
  QueryInterceptResult,
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

export interface DraftPlan {
  readonly ast: AnyQueryAst;
  readonly meta: PlanMeta;
}

export interface SqlMiddleware<TCodecMap extends Record<string, unknown> = Record<string, unknown>>
  extends RuntimeMiddleware<SqlExecutionPlan, SqlParamRefMutator<TCodecMap>> {
  readonly familyId?: 'sql';
  beforeCompile?(draft: DraftPlan, ctx: SqlMiddlewareContext): Promise<DraftPlan | undefined>;
  beforeQuery?(
    plan: SqlExecutionPlan,
    ctx: SqlMiddlewareContext,
    params?: SqlParamRefMutator<TCodecMap>,
  ): void | Promise<void>;
  interceptQuery?(
    plan: SqlExecutionPlan,
    ctx: SqlMiddlewareContext,
  ): Promise<QueryInterceptResult | undefined>;
  onRow?(
    row: Record<string, unknown>,
    plan: SqlExecutionPlan,
    ctx: SqlMiddlewareContext,
  ): Promise<void>;
  afterQuery?(
    plan: SqlExecutionPlan,
    result: AfterQueryResult,
    ctx: SqlMiddlewareContext,
  ): Promise<void>;
  beforeExecute?(
    plan: SqlExecutionPlan,
    ctx: SqlMiddlewareContext,
    params?: SqlParamRefMutator<TCodecMap>,
  ): void | Promise<void>;
  interceptExecute?(
    plan: SqlExecutionPlan,
    ctx: SqlMiddlewareContext,
  ): Promise<ExecuteInterceptResult | undefined>;
  afterExecute?(
    plan: SqlExecutionPlan,
    result: AfterExecuteResult,
    ctx: SqlMiddlewareContext,
  ): Promise<void>;
}
