import type {
  AsyncIterableResult,
  RuntimeExecuteOptions,
} from '@internal/framework-components/runtime';
import { invariant } from '@internal/utils/assertions';
import type { RuntimeQueryable } from '../sql-runtime';
import type { PreparedStatement } from './types';

export const preparedStatementQuery = Symbol('preparedStatementQuery');

export interface PreparedStatementQueryTarget extends RuntimeQueryable {
  [preparedStatementQuery]<Params, Row>(
    statement: PreparedStatement<Params, Row>,
    params: Params,
    options?: RuntimeExecuteOptions,
  ): AsyncIterableResult<Row>;
}

function isPreparedStatementQueryTarget(
  target: RuntimeQueryable,
): target is PreparedStatementQueryTarget {
  return preparedStatementQuery in target;
}

export function runPreparedQuery<Params, Row>(
  target: RuntimeQueryable,
  statement: PreparedStatement<Params, Row>,
  params: Params,
  options?: RuntimeExecuteOptions,
): AsyncIterableResult<Row> {
  invariant(
    isPreparedStatementQueryTarget(target),
    'RuntimeQueryable is missing the prepared statement query bridge',
  );
  return target[preparedStatementQuery](statement, params, options);
}
