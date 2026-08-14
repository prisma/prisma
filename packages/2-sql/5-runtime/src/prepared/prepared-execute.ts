import type { RuntimeExecuteOptions } from '@internal/framework-components/runtime';
import type { SqlStatementStats } from '@internal/sql-relational-core/ast';
import { invariant } from '@internal/utils/assertions';
import type { RuntimeQueryable } from '../sql-runtime';
import type { PreparedExecution } from './types';

export const preparedStatementExecute = Symbol('preparedStatementExecute');

export interface PreparedStatementExecuteTarget extends RuntimeQueryable {
  [preparedStatementExecute]<Params>(
    statement: PreparedExecution<Params>,
    params: Params,
    options?: RuntimeExecuteOptions,
  ): Promise<SqlStatementStats>;
}

function isPreparedStatementExecuteTarget(
  target: RuntimeQueryable,
): target is PreparedStatementExecuteTarget {
  return preparedStatementExecute in target;
}

export function runPreparedExecute<Params>(
  target: RuntimeQueryable,
  statement: PreparedExecution<Params>,
  params: Params,
  options?: RuntimeExecuteOptions,
): Promise<SqlStatementStats> {
  invariant(
    isPreparedStatementExecuteTarget(target),
    'RuntimeQueryable is missing the prepared statement execute bridge',
  );
  return target[preparedStatementExecute](statement, params, options);
}
