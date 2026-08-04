import type { AsyncIterableResult } from '@internal/framework-components/runtime';
import type { SqlExecutionPlan, SqlQueryPlan } from '@internal/sql-relational-core/plan';
import type { RuntimeScope } from '@internal/sql-relational-core/types';

export function executeQueryPlan<Row>(
  scope: RuntimeScope,
  plan: SqlExecutionPlan<Row> | SqlQueryPlan<Row>,
): AsyncIterableResult<Row> {
  return scope.execute(plan);
}
