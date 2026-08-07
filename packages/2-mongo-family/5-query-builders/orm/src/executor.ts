import type {
  AsyncIterableResult,
  RuntimeStatementStats,
} from '@internal/framework-components/runtime';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';

export interface MongoQueryExecutor {
  query<Row>(plan: MongoQueryPlan<Row>): AsyncIterableResult<Row>;
  execute(plan: MongoQueryPlan): Promise<RuntimeStatementStats>;
}
