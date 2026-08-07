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

export interface MongoMiddlewareContext extends RuntimeMiddlewareContext {
  contentHash(exec: MongoExecutionPlan): Promise<string>;
}

export interface MongoMiddleware extends RuntimeMiddleware<MongoExecutionPlan> {
  readonly familyId?: 'mongo';
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
