import type { AsyncIterableResult } from '@internal/framework-components/runtime';
import type { MongoQueryPlan } from '@internal/mongo-query-ast/execution';

export interface MongoQueryExecutor {
  execute<Row>(plan: MongoQueryPlan<Row>): AsyncIterableResult<Row>;
}
